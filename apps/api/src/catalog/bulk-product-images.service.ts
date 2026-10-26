
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Pool, PoolClient } from 'pg';

import type {
  BulkProductImagesInput,
} from './dto/bulk-product-images.dto';

type MediaRow = {
  id: string;
  source_type: string;
  mime_type: string | null;
  status: string;
  storage_key: string | null;
  external_url: string | null;
};

type ImageRow = {
  id: string;
  product_id: string;
  media_id: string;
  variant_id: string | null;
  is_featured: boolean;
  position: number;
  created_at: Date;
};

@Injectable()
export class BulkProductImagesService {
  constructor(
    @Inject('BULK_PRODUCT_IMAGES_POOL')
    private readonly pool: Pool,
  ) {}

  private dbError(error: unknown): never {
    let current: unknown = error;

    while (current && typeof current === 'object') {
      const e = current as {
        code?: string;
        cause?: unknown;
      };

      if (e.code === '23505') {
        throw new ConflictException({
          success: false,
          message:
            'Une relation d’image existe déjà.',
        });
      }

      if (
        e.code === '23503' ||
        e.code === '23514'
      ) {
        throw new BadRequestException({
          success: false,
          message:
            'Relation ou données d’image invalides.',
        });
      }

      current = e.cause;
    }

    throw error;
  }

  private async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `SET LOCAL lock_timeout = '5s'`,
      );

      const result = await callback(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }

      this.dbError(error);
    } finally {
      client.release();
    }
  }

  private async ensureProduct(
    client: PoolClient,
    productId: string,
  ): Promise<void> {
    const product = await client.query(
      `SELECT id
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [productId],
    );

    if (!product.rowCount) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    const deleted = await client.query(
      `SELECT 1
       FROM product_deletion_state
       WHERE product_id = $1`,
      [productId],
    );

    if (deleted.rowCount) {
      throw new ConflictException({
        success: false,
        message:
          'Impossible de modifier un produit dans la corbeille.',
      });
    }
  }

  private async ensureMedia(
    client: PoolClient,
    mediaIds: string[],
  ): Promise<void> {
    const result = await client.query<MediaRow>(
      `SELECT
         id,
         source_type::text AS source_type,
         mime_type,
         status::text AS status,
         storage_key,
         external_url
       FROM media
       WHERE id = ANY($1::uuid[])
       FOR KEY SHARE`,
      [mediaIds],
    );

    const found = new Map(
      result.rows.map((row) => [row.id, row]),
    );

    for (const mediaId of mediaIds) {
      const media = found.get(mediaId);

      if (!media) {
        throw new NotFoundException({
          success: false,
          message: `Média introuvable : ${mediaId}`,
        });
      }

      if (media.status !== 'ready') {
        throw new ConflictException({
          success: false,
          message:
            `Le média ${mediaId} n'est pas prêt.`,
        });
      }

      if (
        media.mime_type !== null &&
        !media.mime_type.startsWith('image/')
      ) {
        throw new BadRequestException({
          success: false,
          message:
            `Le média ${mediaId} n'est pas une image.`,
        });
      }

      if (
        !media.storage_key &&
        !media.external_url
      ) {
        throw new BadRequestException({
          success: false,
          message:
            `Le média ${mediaId} n'a aucune source.`,
        });
      }
    }
  }

  private async ensureVariants(
    client: PoolClient,
    productId: string,
    variantIds: string[],
  ): Promise<void> {
    if (!variantIds.length) return;

    const result = await client.query<{
      id: string;
    }>(
      `SELECT id
       FROM product_variants
       WHERE product_id = $1
         AND id = ANY($2::uuid[])
       FOR KEY SHARE`,
      [productId, variantIds],
    );

    const found = new Set(
      result.rows.map((row) => row.id),
    );

    for (const id of variantIds) {
      if (!found.has(id)) {
        throw new BadRequestException({
          success: false,
          message:
            'Une variation ne correspond pas au produit.',
          errors: {
            variantId: [id],
          },
        });
      }
    }
  }

  private async readGallery(
    client: PoolClient,
    productId: string,
  ) {
    const result = await client.query(
      `SELECT
         pi.id,
         pi.product_id,
         pi.media_id,
         pi.variant_id,
         pi.is_featured,
         pi.position,
         pi.created_at,
         m.source_type::text AS source_type,
         m.storage_provider::text AS storage_provider,
         m.storage_key,
         m.external_url,
         m.original_name,
         m.mime_type,
         m.alt_text,
         m.width,
         m.height,
         m.status::text AS media_status
       FROM product_images pi
       JOIN media m
         ON m.id = pi.media_id
       WHERE pi.product_id = $1
       ORDER BY
         pi.is_featured DESC,
         pi.position ASC,
         pi.created_at ASC,
         pi.id ASC`,
      [productId],
    );

    return result.rows;
  }

  async addBulk(
    productId: string,
    input: BulkProductImagesInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      // A product-level lock serializes gallery writes
      // that follow the same convention.
      await this.ensureProduct(client, productId);

      const mediaIds = [
        ...new Set(
          input.images.map((image) => image.mediaId),
        ),
      ];

      const variantIds = [
        ...new Set(
          input.images
            .map((image) => image.variantId)
            .filter(
              (id): id is string =>
                typeof id === 'string',
            ),
        ),
      ];

      await this.ensureMedia(client, mediaIds);

      await this.ensureVariants(
        client,
        productId,
        variantIds,
      );

      // Reject duplicates with the existing gallery.
      const existing = await client.query<{
        media_id: string;
        variant_id: string | null;
      }>(
        `SELECT media_id, variant_id
         FROM product_images
         WHERE product_id = $1`,
        [productId],
      );

      const existingKeys = new Set(
        existing.rows.map(
          (row) =>
            `${row.media_id}:${row.variant_id ?? 'general'}`,
        ),
      );

      for (const image of input.images) {
        const key =
          `${image.mediaId}:${image.variantId ?? 'general'}`;

        if (existingKeys.has(key)) {
          throw new ConflictException({
            success: false,
            message:
              'Une image est déjà liée à ce produit ou à cette variation.',
            errors: {
              mediaId: [image.mediaId],
            },
          });
        }
      }

      const state = await client.query<{
        next_position: number;
        total: number;
        featured_count: number;
      }>(
        `SELECT
           (COALESCE(MAX(position), -1) + 1)::int
             AS next_position,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE is_featured = true
           )::int AS featured_count
         FROM product_images
         WHERE product_id = $1`,
        [productId],
      );

      const current = state.rows[0];

      let position =
        current?.next_position ?? 0;

      const hasExplicitFeatured =
        input.images.some(
          (image) => image.isFeatured,
        );

      // Automatically feature the first image
      // only if no featured image already exists
      // and no explicit one was selected.
      const autoFeatured =
        (current?.featured_count ?? 0) === 0 &&
        !hasExplicitFeatured;

      if (hasExplicitFeatured) {
        await client.query(
          `UPDATE product_images
           SET is_featured = false
           WHERE product_id = $1
             AND is_featured = true`,
          [productId],
        );
      }

      const inserted: ImageRow[] = [];

      for (
        let index = 0;
        index < input.images.length;
        index++
      ) {
        const image = input.images[index];

        const imagePosition =
          image.position ?? position++;

        const featured =
          image.isFeatured ||
          (autoFeatured && index === 0);

        const result = await client.query<ImageRow>(
          `INSERT INTO product_images (
             product_id,
             media_id,
             variant_id,
             is_featured,
             position
           )
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            productId,
            image.mediaId,
            image.variantId ?? null,
            featured,
            imagePosition,
          ],
        );

        inserted.push(result.rows[0]);
      }

      await client.query(
        `INSERT INTO product_activity (
           product_id,
           actor_id,
           action,
           changes
         )
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          productId,
          adminId,
          'product.images_bulk_added',
          JSON.stringify({
            images: inserted.map((image) => ({
              imageId: image.id,
              mediaId: image.media_id,
              variantId: image.variant_id,
              isFeatured: image.is_featured,
              position: image.position,
            })),
          }),
        ],
      );

      await client.query(
        `UPDATE products
         SET updated_by = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [productId, adminId],
      );

      return {
        productId,
        addedCount: inserted.length,
        images: inserted,
        gallery: await this.readGallery(
          client,
          productId,
        ),
      };
    });
  }
}
