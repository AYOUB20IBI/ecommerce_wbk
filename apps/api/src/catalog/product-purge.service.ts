
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Pool, PoolClient } from 'pg';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
};

type CountRow = {
  total: number;
};

type UnsafeRelation = {
  referencing_table: string;
  constraint_name: string;
  delete_action: string;
};

@Injectable()
export class ProductPurgeService {
  constructor(
    @Inject('PRODUCT_PURGE_POOL')
    private readonly pool: Pool,
  ) {}

  private async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve original error.
      }

      throw error;
    } finally {
      client.release();
    }
  }

  private async count(
    client: PoolClient,
    query: string,
    params: unknown[],
  ): Promise<number> {
    const result = await client.query<CountRow>(
      query,
      params,
    );

    return result.rows[0]?.total ?? 0;
  }

  /**
   * Block purge when the database contains
   * an unfamiliar FK from a table to products
   * or product_variants.
   *
   * Known catalog relations are allowed.
   * Order, invoice, payment and inventory
   * relations are always blocked.
   */
  private async ensureSafeRelations(
    client: PoolClient,
  ): Promise<void> {
    const rows = await client.query<UnsafeRelation>(
      `SELECT
         con.conrelid::regclass::text
           AS referencing_table,
         con.conname AS constraint_name,
         con.confdeltype::text AS delete_action
       FROM pg_constraint con
       WHERE con.contype = 'f'
         AND con.confrelid IN (
           'public.products'::regclass,
           'public.product_variants'::regclass
         )`,
    );

    const allowedTables = new Set([
      'attributes',
      'product_activity',
      'product_attribute_values',
      'product_attributes',
      'product_brands',
      'product_categories',
      'product_deletion_state',
      'product_images',
      'product_tags',
      'product_variants',
      'variant_attribute_values',
    ]);

    const unsafe = rows.rows.filter((row) => {
      const table = row.referencing_table
        .split('.')
        .pop()
        ?.replaceAll('"', '') ?? '';

      return !allowedTables.has(table);
    });

    if (unsafe.length > 0) {
      throw new ConflictException({
        success: false,
        message:
          'Suppression impossible : des relations supplémentaires doivent être vérifiées.',
        errors: unsafe.map((item) => ({
          table: item.referencing_table,
          constraint: item.constraint_name,
        })),
      });
    }

    // Conservative safety gate for future commerce
    // tables that may store product IDs in JSON
    // or ordinary columns without foreign keys.
    const businessTables = await client.query<{
      table_name: string;
    }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND (
           table_name ~* '(^|_)(orders?|invoices?|payments?|refunds?|shipments?|carts?|inventory|reservations?)(_|$)'
         )
       ORDER BY table_name`,
    );

    if (businessTables.rows.length > 0) {
      throw new ConflictException({
        success: false,
        message:
          'Suppression définitive désactivée : vérification des commandes et documents commerciaux requise.',
        tables: businessTables.rows.map(
          (row) => row.table_name,
        ),
      });
    }
  }

  /**
   * Explicitly verify the known schema behavior.
   * Never silently rely on changed FK actions.
   */
  private async ensureExpectedConstraints(
    client: PoolClient,
  ): Promise<void> {
    const required = [
      {
        name:
          'product_activity_product_id_products_id_fk',
        deleteType: 'r',
      },
      {
        name: 'product_deletion_state_product_fk',
        deleteType: 'r',
      },
    ];

    const result = await client.query<{
      conname: string;
      confdeltype: string;
    }>(
      `SELECT conname, confdeltype::text
       FROM pg_constraint
       WHERE contype = 'f'
         AND confrelid = 'public.products'::regclass
         AND conname = ANY($1::text[])`,
      [required.map((item) => item.name)],
    );

    for (const expected of required) {
      const found = result.rows.find(
        (row) => row.conname === expected.name,
      );

      if (
        !found ||
        found.confdeltype !== expected.deleteType
      ) {
        throw new ConflictException({
          success: false,
          message:
            'La structure de la base de données a changé. Suppression bloquée.',
        });
      }
    }
  }

  async purge(
    productId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      // Prevent hanging transactions.
      await client.query(
        `SET LOCAL lock_timeout = '5s'`,
      );

      // All operations must lock the product.
      const productResult =
        await client.query<ProductRow>(
          `SELECT id, name, slug, type, status
           FROM products
           WHERE id = $1
           FOR UPDATE`,
          [productId],
        );

      const product = productResult.rows[0];

      if (!product) {
        throw new NotFoundException({
          success: false,
          message: 'Produit introuvable.',
        });
      }

      // Product must be in the dedicated Trash.
      const deletionResult = await client.query<{
        previous_status: string;
        deleted_at: Date;
      }>(
        `SELECT previous_status, deleted_at
         FROM product_deletion_state
         WHERE product_id = $1
         FOR UPDATE`,
        [productId],
      );

      const deletion = deletionResult.rows[0];

      if (!deletion || product.status !== 'archived') {
        throw new ConflictException({
          success: false,
          message:
            'Déplacez le produit dans la corbeille avant sa suppression définitive.',
        });
      }

      await this.ensureSafeRelations(client);
      await this.ensureExpectedConstraints(client);

      // Collect counts for the independent audit.
      const variantsCount = await this.count(
        client,
        `SELECT COUNT(*)::int AS total
         FROM product_variants
         WHERE product_id = $1`,
        [productId],
      );

      const imagesCount = await this.count(
        client,
        `SELECT COUNT(*)::int AS total
         FROM product_images
         WHERE product_id = $1`,
        [productId],
      );

      const activityCount = await this.count(
        client,
        `SELECT COUNT(*)::int AS total
         FROM product_activity
         WHERE product_id = $1`,
        [productId],
      );

      const categoriesCount = await this.count(
        client,
        `SELECT COUNT(*)::int AS total
         FROM product_categories
         WHERE product_id = $1`,
        [productId],
      );

      const tagsCount = await this.count(
        client,
        `SELECT COUNT(*)::int AS total
         FROM product_tags
         WHERE product_id = $1`,
        [productId],
      );

      // Archive existing product activity
      // before deleting it from product_activity.
      const historyResult = await client.query<{
        history: unknown;
      }>(
        `SELECT COALESCE(
           jsonb_agg(
             to_jsonb(pa)
             ORDER BY pa.created_at, pa.id
           ),
           '[]'::jsonb
         ) AS history
         FROM product_activity pa
         WHERE pa.product_id = $1`,
        [productId],
      );

      const metadata = {
        previousStatus: deletion.previous_status,
        deletedAt: deletion.deleted_at.toISOString(),
        counts: {
          variants: variantsCount,
          images: imagesCount,
          activities: activityCount,
          categories: categoriesCount,
          tags: tagsCount,
        },
        productActivity:
          historyResult.rows[0]?.history ?? [],
        physicalMediaFilesDeleted: false,
      };

      // Keep an independent audit without a FK
      // to the product being deleted.
      const auditResult = await client.query<{
        id: string;
        purged_at: Date;
      }>(
        `INSERT INTO product_purge_audit (
           product_id,
           product_name,
           product_slug,
           product_type,
           purged_by,
           metadata
         )
         VALUES (
           $1, $2, $3, $4, $5, $6::jsonb
         )
         RETURNING id, purged_at`,
        [
          productId,
          product.name,
          product.slug,
          product.type,
          adminId,
          JSON.stringify(metadata),
        ],
      );

      // Both tables have RESTRICT relationships.
      // Remove their rows intentionally.
      await client.query(
        `DELETE FROM product_activity
         WHERE product_id = $1`,
        [productId],
      );

      await client.query(
        `DELETE FROM product_deletion_state
         WHERE product_id = $1`,
        [productId],
      );

      // Known CASCADE relations are removed by
      // PostgreSQL in the same transaction.
      const deleted = await client.query<{ id: string }>(
        `DELETE FROM products
         WHERE id = $1
         RETURNING id`,
        [productId],
      );

      if (deleted.rowCount !== 1) {
        throw new ConflictException({
          success: false,
          message:
            'La suppression définitive a échoué.',
        });
      }

      return {
        productId,
        productName: product.name,
        permanentlyDeleted: true,
        auditId: auditResult.rows[0].id,
        purgedAt: auditResult.rows[0].purged_at,
        mediaFilesPreserved: true,
      };
    });
  }
}
