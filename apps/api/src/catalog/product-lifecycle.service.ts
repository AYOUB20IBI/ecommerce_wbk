
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Pool,
  PoolClient,
} from 'pg';

type ProductRow = {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'published' | 'private' | 'archived';
};

type DeletionRow = {
  product_id: string;
  previous_status: ProductRow['status'];
  deleted_by: string | null;
  deleted_at: Date;
};

@Injectable()
export class ProductLifecycleService {
  constructor(
    @Inject('PRODUCT_LIFECYCLE_POOL')
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

  private async getProduct(
    client: PoolClient,
    id: string,
    lock: boolean,
  ): Promise<ProductRow> {
    const result = await client.query<ProductRow>(
      `SELECT id, name, type, status
       FROM products
       WHERE id = $1
       ${lock ? 'FOR UPDATE' : ''}
       LIMIT 1`,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    return result.rows[0];
  }

  private async getDeletion(
    client: PoolClient,
    productId: string,
  ): Promise<DeletionRow | null> {
    const result = await client.query<DeletionRow>(
      `SELECT
         product_id,
         previous_status,
         deleted_by,
         deleted_at
       FROM product_deletion_state
       WHERE product_id = $1`,
      [productId],
    );

    return result.rows[0] ?? null;
  }

  private async audit(
    client: PoolClient,
    productId: string,
    adminId: string,
    action: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO product_activity
         (product_id, actor_id, action, changes)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        productId,
        adminId,
        action,
        JSON.stringify(changes),
      ],
    );
  }

  // =====================================
  // SOFT DELETE
  // =====================================

  async remove(
    productId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      const product = await this.getProduct(
        client,
        productId,
        true,
      );

      const existing = await this.getDeletion(
        client,
        productId,
      );

      if (existing) {
        throw new ConflictException({
          success: false,
          message: 'Ce produit est déjà supprimé.',
        });
      }

      await client.query(
        `INSERT INTO product_deletion_state (
           product_id,
           previous_status,
           deleted_by
         )
         VALUES ($1, $2, $3)`,
        [productId, product.status, adminId],
      );

      await client.query(
        `UPDATE products
         SET
           status = 'archived',
           updated_by = $2,
           updated_at = NOW()
         WHERE id = $1`,
        [productId, adminId],
      );

      await this.audit(
        client,
        productId,
        adminId,
        'product.soft_deleted',
        {
          previousStatus: product.status,
          newStatus: 'archived',
        },
      );

      return {
        id: productId,
        name: product.name,
        deleted: true,
        status: 'archived',
        previousStatus: product.status,
      };
    });
  }

  // =====================================
  // RESTORE
  // =====================================

  async restore(
    productId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.getProduct(
        client,
        productId,
        true,
      );

      const deletion = await this.getDeletion(
        client,
        productId,
      );

      if (!deletion) {
        throw new ConflictException({
          success: false,
          message: "Ce produit n'est pas supprimé.",
        });
      }

      let restoredStatus = deletion.previous_status;

      // A previously published product must still
      // satisfy the minimum publication rule.
      if (restoredStatus === 'published') {
        const result = await client.query<{
          total: number;
        }>(
          `SELECT COUNT(*)::int AS total
           FROM product_variants
           WHERE product_id = $1
             AND is_active = true
             AND regular_price IS NOT NULL`,
          [productId],
        );

        if ((result.rows[0]?.total ?? 0) === 0) {
          restoredStatus = 'draft';
        }
      }

      await client.query(
        `UPDATE products
         SET
           status = $2::product_status,
           updated_by = $3,
           updated_at = NOW()
         WHERE id = $1`,
        [productId, restoredStatus, adminId],
      );

      await client.query(
        `DELETE FROM product_deletion_state
         WHERE product_id = $1`,
        [productId],
      );

      await this.audit(
        client,
        productId,
        adminId,
        'product.restored',
        {
          deletedAt: deletion.deleted_at.toISOString(),
          previousStatus: deletion.previous_status,
          restoredStatus,
          restoredFromDeletion: true,
        },
      );

      return {
        id: productId,
        restored: true,
        status: restoredStatus,
        restoredAsDraft:
          deletion.previous_status === 'published' &&
          restoredStatus === 'draft',
      };
    });
  }

  // =====================================
  // GET DELETION STATUS
  // =====================================

  async status(productId: string) {
    const client = await this.pool.connect();

    try {
      const product = await this.getProduct(
        client,
        productId,
        false,
      );

      const deletion = await this.getDeletion(
        client,
        productId,
      );

      return {
        id: product.id,
        name: product.name,
        type: product.type,
        status: product.status,
        isDeleted: deletion !== null,
        previousStatus:
          deletion?.previous_status ?? null,
        deletedBy: deletion?.deleted_by ?? null,
        deletedAt:
          deletion?.deleted_at ?? null,
      };
    } finally {
      client.release();
    }
  }
}
