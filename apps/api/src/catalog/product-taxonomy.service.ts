
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Pool,
  PoolClient,
} from 'pg';

import type {
  UpdateProductTaxonomiesInput,
} from './dto/product-taxonomy.dto';

type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
};

type ProductRow = {
  id: string;
  name: string;
  type: string;
  status: string;
};

@Injectable()
export class ProductTaxonomyService {
  constructor(
    @Inject('PRODUCT_TAXONOMY_POOL')
    private readonly pool: Pool,
  ) {}

  // =========================================
  // DATABASE ERROR HANDLING
  // =========================================

  private handleDatabaseError(error: unknown): never {
    let current: unknown = error;

    while (current && typeof current === 'object') {
      const candidate = current as {
        code?: string;
        cause?: unknown;
      };

      if (candidate.code === '23503') {
        throw new BadRequestException({
          success: false,
          message:
            'Une marque, catégorie ou étiquette est invalide.',
        });
      }

      if (candidate.code === '23505') {
        throw new ConflictException({
          success: false,
          message:
            'Une relation existe déjà.',
        });
      }

      current = candidate.cause;
    }

    throw error;
  }

  // =========================================
  // TRANSACTION
  // =========================================

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
        // Preserve the original database error.
      }

      this.handleDatabaseError(error);
    } finally {
      client.release();
    }
  }

  // =========================================
  // VERIFY PRODUCT
  // =========================================

  private async ensureProduct(
    client: PoolClient,
    productId: string,
    lock = false,
  ): Promise<ProductRow> {
    const result = await client.query<ProductRow>(
      `SELECT id, name, type, status
       FROM products
       WHERE id = $1
       ${lock ? 'FOR UPDATE' : ''}
       LIMIT 1`,
      [productId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    return result.rows[0];
  }

  // =========================================
  // VERIFY BRAND
  // =========================================

  private async ensureBrand(
    client: PoolClient,
    brandId: string,
  ): Promise<void> {
    const result = await client.query(
      `SELECT id
       FROM brands
       WHERE id = $1
       FOR KEY SHARE`,
      [brandId],
    );

    if (!result.rows.length) {
      throw new BadRequestException({
        success: false,
        message: 'Marque introuvable.',
        errors: {
          brandId: ['Cette marque n’existe pas.'],
        },
      });
    }
  }

  // =========================================
  // VERIFY CATEGORY / TAG IDS
  // =========================================

  private async ensureIds(
    client: PoolClient,
    table: 'categories' | 'tags',
    ids: string[],
  ): Promise<void> {
    if (!ids.length) return;

    // Static table whitelist; never constructed
    // from unvalidated client input.
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM ${table}
       WHERE id = ANY($1::uuid[])
       FOR KEY SHARE`,
      [ids],
    );

    const existing = new Set(
      result.rows.map((row) => row.id),
    );

    const missing = ids.filter(
      (id) => !existing.has(id),
    );

    if (missing.length) {
      throw new BadRequestException({
        success: false,
        message:
          table === 'categories'
            ? 'Catégorie introuvable.'
            : 'Étiquette introuvable.',
        errors: {
          [table === 'categories'
            ? 'categoryIds'
            : 'tagIds']: [
              'Un ou plusieurs identifiants sont invalides.',
            ],
        },
      });
    }
  }

  // =========================================
  // READ TAXONOMIES
  // =========================================

  private async readRelations(
    client: PoolClient,
    productId: string,
  ) {
    const brandResult = await client.query<TaxonomyRow>(
      `SELECT b.id, b.name, b.slug
       FROM product_brands pb
       INNER JOIN brands b
         ON b.id = pb.brand_id
       WHERE pb.product_id = $1`,
      [productId],
    );

    const categoriesResult =
      await client.query<TaxonomyRow & {
        parent_id: string | null;
      }>(
        `SELECT
           c.id,
           c.name,
           c.slug,
           c.parent_id
         FROM product_categories pc
         INNER JOIN categories c
           ON c.id = pc.category_id
         WHERE pc.product_id = $1
         ORDER BY c.name ASC, c.id ASC`,
        [productId],
      );

    const tagsResult =
      await client.query<TaxonomyRow>(
        `SELECT t.id, t.name, t.slug
         FROM product_tags pt
         INNER JOIN tags t
           ON t.id = pt.tag_id
         WHERE pt.product_id = $1
         ORDER BY t.name ASC, t.id ASC`,
        [productId],
      );

    return {
      brand: brandResult.rows[0] ?? null,
      categories: categoriesResult.rows,
      tags: tagsResult.rows,
    };
  }

  // =========================================
  // GET PRODUCT TAXONOMIES
  // =========================================

  async findOne(productId: string) {
    const client = await this.pool.connect();

    try {
      const product = await this.ensureProduct(
        client,
        productId,
      );

      const relations = await this.readRelations(
        client,
        productId,
      );

      return {
        product: {
          id: product.id,
          name: product.name,
          type: product.type,
          status: product.status,
        },
        ...relations,
      };
    } finally {
      client.release();
    }
  }

  // =========================================
  // UPDATE PRODUCT TAXONOMIES
  // =========================================

  async update(
    productId: string,
    input: UpdateProductTaxonomiesInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      // Lock product before changing relations.
      const product = await this.ensureProduct(
        client,
        productId,
        true,
      );

      // Validate all requested entities BEFORE writes.
      if (
        input.brandId !== undefined &&
        input.brandId !== null
      ) {
        await this.ensureBrand(
          client,
          input.brandId,
        );
      }

      if (input.categoryIds !== undefined) {
        await this.ensureIds(
          client,
          'categories',
          input.categoryIds,
        );
      }

      if (input.tagIds !== undefined) {
        await this.ensureIds(
          client,
          'tags',
          input.tagIds,
        );
      }

      const before = await this.readRelations(
        client,
        productId,
      );

      // =====================================
      // BRAND — REPLACE OR REMOVE
      // =====================================

      if (input.brandId !== undefined) {
        if (input.brandId === null) {
          await client.query(
            `DELETE FROM product_brands
             WHERE product_id = $1`,
            [productId],
          );
        } else {
          await client.query(
            `INSERT INTO product_brands
               (product_id, brand_id)
             VALUES ($1, $2)
             ON CONFLICT (product_id)
             DO UPDATE SET
               brand_id = EXCLUDED.brand_id`,
            [productId, input.brandId],
          );
        }
      }

      // =====================================
      // CATEGORIES — REPLACE ENTIRE SET
      // =====================================

      if (input.categoryIds !== undefined) {
        await client.query(
          `DELETE FROM product_categories
           WHERE product_id = $1`,
          [productId],
        );

        if (input.categoryIds.length) {
          await client.query(
            `INSERT INTO product_categories
               (product_id, category_id)
             SELECT $1::uuid, x.id
             FROM unnest($2::uuid[]) AS x(id)`,
            [productId, input.categoryIds],
          );
        }
      }

      // =====================================
      // TAGS — REPLACE ENTIRE SET
      // =====================================

      if (input.tagIds !== undefined) {
        await client.query(
          `DELETE FROM product_tags
           WHERE product_id = $1`,
          [productId],
        );

        if (input.tagIds.length) {
          await client.query(
            `INSERT INTO product_tags
               (product_id, tag_id)
             SELECT $1::uuid, x.id
             FROM unnest($2::uuid[]) AS x(id)`,
            [productId, input.tagIds],
          );
        }
      }

      const after = await this.readRelations(
        client,
        productId,
      );

      // =====================================
      // AUDIT — ONLY WHEN CHANGED
      // =====================================

      const oldBrandId = before.brand?.id ?? null;
      const newBrandId = after.brand?.id ?? null;

      const oldCategoryIds = before.categories
        .map((category) => category.id)
        .sort();

      const newCategoryIds = after.categories
        .map((category) => category.id)
        .sort();

      const oldTagIds = before.tags
        .map((tag) => tag.id)
        .sort();

      const newTagIds = after.tags
        .map((tag) => tag.id)
        .sort();

      const changes: Record<string, unknown> = {};

      if (oldBrandId !== newBrandId) {
        changes.brandId = {
          old: oldBrandId,
          new: newBrandId,
        };
      }

      if (
        JSON.stringify(oldCategoryIds) !==
        JSON.stringify(newCategoryIds)
      ) {
        changes.categoryIds = {
          old: oldCategoryIds,
          new: newCategoryIds,
        };
      }

      if (
        JSON.stringify(oldTagIds) !==
        JSON.stringify(newTagIds)
      ) {
        changes.tagIds = {
          old: oldTagIds,
          new: newTagIds,
        };
      }

      if (Object.keys(changes).length) {
        await client.query(
          `UPDATE products
           SET
             updated_by = $2,
             updated_at = NOW()
           WHERE id = $1`,
          [productId, adminId],
        );

        await client.query(
          `INSERT INTO product_activity
             (
               product_id,
               actor_id,
               action,
               changes
             )
           VALUES (
             $1,
             $2,
             'product.taxonomies_updated',
             $3::jsonb
           )`,
          [
            productId,
            adminId,
            JSON.stringify(changes),
          ],
        );
      }

      return {
        product: {
          id: product.id,
          name: product.name,
          type: product.type,
          status: product.status,
        },
        ...after,
        changed: Object.keys(changes).length > 0,
      };
    });
  }
}
