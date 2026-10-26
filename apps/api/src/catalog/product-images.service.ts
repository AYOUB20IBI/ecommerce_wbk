
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Pool, PoolClient } from 'pg';

import type {
  AddProductImageInput,
  UpdateProductImageInput,
  ReorderProductImagesInput,
} from './dto/product-images.dto';

type ProductRow = {
  id: string;
  name: string;
  type: string;
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

type GalleryRow = ImageRow & {
  source_type: string;
  storage_provider: string | null;
  storage_key: string | null;
  external_url: string | null;
  original_name: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  media_status: string;
};

@Injectable()
export class ProductImagesService {
  constructor(
    @Inject('PRODUCT_IMAGES_POOL')
    private readonly pool: Pool,
  ) {}

  // ========================================
  // TRANSACTION
  // ========================================

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
        // Keep original error.
      }

      let current: unknown = error;

      while (
        current &&
        typeof current === 'object'
      ) {
        const err = current as {
          code?: string;
          cause?: unknown;
        };

        if (err.code === '23505') {
          throw new ConflictException({
            success: false,
            message: 'Cette relation existe déjà.',
          });
        }

        if (err.code === '23503') {
          throw new BadRequestException({
            success: false,
            message:
              'Référence de produit, variation ou média invalide.',
          });
        }

        current = err.cause;
      }

      throw error;
    } finally {
      client.release();
    }
  }

  // ========================================
  // PRODUCT VALIDATION
  // ========================================

  private async ensureProduct(
    client: PoolClient,
    productId: string,
    lock = false,
  ): Promise<ProductRow> {
    const result = await client.query<ProductRow>(
      `SELECT id, name, type
       FROM products
       WHERE id = $1
       ${lock ? 'FOR UPDATE' : ''}
       LIMIT 1`,
      [productId],
    );

    const product = result.rows[0];

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    const deleted = await client.query(
      `SELECT 1
       FROM product_deletion_state
       WHERE product_id = $1
       LIMIT 1`,
      [productId],
    );

    if (deleted.rows.length > 0) {
      throw new ConflictException({
        success: false,
        message:
          'Impossible de modifier les images d’un produit dans la corbeille.',
      });
    }

    return product;
  }

  // ========================================
  // VARIANT VALIDATION
  // ========================================

  private async ensureVariant(
    client: PoolClient,
    productId: string,
    variantId: string | null | undefined,
  ): Promise<void> {
    if (variantId == null) return;

    const result = await client.query(
      `SELECT 1
       FROM product_variants
       WHERE id = $1
         AND product_id = $2
       LIMIT 1`,
      [variantId, productId],
    );

    if (!result.rows.length) {
      throw new BadRequestException({
        success: false,
        message:
          'Cette variation n’appartient pas au produit.',
        errors: {
          variantId: ['Variation invalide.'],
        },
      });
    }
  }

  // ========================================
  // MEDIA VALIDATION
  // ========================================

  private async ensureMedia(
    client: PoolClient,
    mediaId: string,
  ): Promise<void> {
    const result = await client.query<{
      id: string;
      status: string;
      mime_type: string | null;
      source_type: string;
    }>(
      `SELECT id, status, mime_type, source_type
       FROM media
       WHERE id = $1
       FOR KEY SHARE`,
      [mediaId],
    );

    const media = result.rows[0];

    if (!media) {
      throw new NotFoundException({
        success: false,
        message: 'Média introuvable.',
      });
    }

    if (media.status !== 'ready') {
      throw new ConflictException({
        success: false,
        message:
          'Le média doit être prêt avant son utilisation.',
      });
    }

    if (
      media.mime_type !== null &&
      !media.mime_type.startsWith('image/')
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Seules les images peuvent être ajoutées à la galerie.',
      });
    }

    // External URLs without a MIME type need
    // validation in the media ingestion layer.
  }

  // ========================================
  // IMAGE VALIDATION
  // ========================================

  private async ensureImage(
    client: PoolClient,
    productId: string,
    imageId: string,
  ): Promise<ImageRow> {
    const result = await client.query<ImageRow>(
      `SELECT *
       FROM product_images
       WHERE id = $1
         AND product_id = $2
       LIMIT 1`,
      [imageId, productId],
    );

    const image = result.rows[0];

    if (!image) {
      throw new NotFoundException({
        success: false,
        message: 'Image introuvable.',
      });
    }

    return image;
  }

  // ========================================
  // GALLERY QUERY
  // ========================================

  private async gallery(
    client: PoolClient,
    productId: string,
  ): Promise<GalleryRow[]> {
    const result = await client.query<GalleryRow>(
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
         m.width,
         m.height,
         m.alt_text,
         m.status::text AS media_status
       FROM product_images pi
       INNER JOIN media m
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

  // ========================================
  // AUDIT
  // ========================================

  private async audit(
    client: PoolClient,
    productId: string,
    adminId: string,
    action: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
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
        action,
        JSON.stringify(changes),
      ],
    );

    await client.query(
      `UPDATE products
       SET updated_by = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [productId, adminId],
    );
  }

  // ========================================
  // GET GALLERY
  // ========================================

  async findAll(productId: string) {
    const client = await this.pool.connect();

    try {
      await this.ensureProduct(client, productId);

      return await this.gallery(client, productId);
    } finally {
      client.release();
    }
  }

  // ========================================
  // ADD IMAGE
  // ========================================

  async add(
    productId: string,
    input: AddProductImageInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.ensureProduct(
        client,
        productId,
        true,
      );

      await this.ensureMedia(
        client,
        input.mediaId,
      );

      await this.ensureVariant(
        client,
        productId,
        input.variantId,
      );

      const variantId = input.variantId ?? null;

      // Prevent identical media / variant
      // relations within the same product.
      const duplicate = await client.query(
        `SELECT 1
         FROM product_images
         WHERE product_id = $1
           AND media_id = $2
           AND variant_id IS NOT DISTINCT FROM $3::uuid
         LIMIT 1`,
        [
          productId,
          input.mediaId,
          variantId,
        ],
      );

      if (duplicate.rows.length) {
        throw new ConflictException({
          success: false,
          message:
            'Cette image est déjà liée à cette galerie ou variation.',
        });
      }

      let position = input.position;

      if (position === undefined) {
        const result = await client.query<{
          next_position: number;
        }>(
          `SELECT
             (COALESCE(MAX(position), -1) + 1)::int
               AS next_position
           FROM product_images
           WHERE product_id = $1`,
          [productId],
        );

        position =
          result.rows[0]?.next_position ?? 0;
      }

      // If this is the first image, select it
      // as featured automatically.
      const countResult = await client.query<{
        total: number;
      }>(
        `SELECT COUNT(*)::int AS total
         FROM product_images
         WHERE product_id = $1`,
        [productId],
      );

      const isFirst =
        (countResult.rows[0]?.total ?? 0) === 0;

      const isFeatured =
        input.isFeatured || isFirst;

      if (isFeatured) {
        await client.query(
          `UPDATE product_images
           SET is_featured = false
           WHERE product_id = $1
             AND is_featured = true`,
          [productId],
        );
      }

      const created = await client.query<ImageRow>(
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
          input.mediaId,
          variantId,
          isFeatured,
          position,
        ],
      );

      const image = created.rows[0];

      await this.audit(
        client,
        productId,
        adminId,
        'product.image_added',
        {
          imageId: image.id,
          mediaId: input.mediaId,
          variantId,
          isFeatured,
          position,
        },
      );

      return {
        image,
        gallery: await this.gallery(
          client,
          productId,
        ),
      };
    });
  }

  // ========================================
  // UPDATE IMAGE
  // ========================================

  async update(
    productId: string,
    imageId: string,
    input: UpdateProductImageInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.ensureProduct(
        client,
        productId,
        true,
      );

      const oldImage = await this.ensureImage(
        client,
        productId,
        imageId,
      );

      if (input.variantId !== undefined) {
        await this.ensureVariant(
          client,
          productId,
          input.variantId,
        );
      }

      const nextVariantId =
        input.variantId === undefined
          ? oldImage.variant_id
          : input.variantId;

      const nextPosition =
        input.position ?? oldImage.position;

      const nextFeatured =
        input.isFeatured ?? oldImage.is_featured;

      if (
        input.isFeatured === true &&
        !oldImage.is_featured
      ) {
        await client.query(
          `UPDATE product_images
           SET is_featured = false
           WHERE product_id = $1
             AND is_featured = true`,
          [productId],
        );
      }

      const changes: Record<string, unknown> = {};

      if (nextVariantId !== oldImage.variant_id) {
        changes.variantId = {
          old: oldImage.variant_id,
          new: nextVariantId,
        };
      }

      if (nextPosition !== oldImage.position) {
        changes.position = {
          old: oldImage.position,
          new: nextPosition,
        };
      }

      if (nextFeatured !== oldImage.is_featured) {
        changes.isFeatured = {
          old: oldImage.is_featured,
          new: nextFeatured,
        };
      }

      // Preserve the previous featured image
      // if the requested image is unchanged.
      if (!Object.keys(changes).length) {
        return {
          image: oldImage,
          changed: false,
          gallery: await this.gallery(
            client,
            productId,
          ),
        };
      }

      await client.query(
        `UPDATE product_images
         SET variant_id = $3,
             position = $4,
             is_featured = $5
         WHERE id = $1
           AND product_id = $2`,
        [
          imageId,
          productId,
          nextVariantId,
          nextPosition,
          nextFeatured,
        ],
      );

      await this.audit(
        client,
        productId,
        adminId,
        'product.image_updated',
        {
          imageId,
          changes,
        },
      );

      return {
        imageId,
        changed: true,
        gallery: await this.gallery(
          client,
          productId,
        ),
      };
    });
  }

  // ========================================
  // REMOVE IMAGE RELATION
  // ========================================

  async remove(
    productId: string,
    imageId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.ensureProduct(
        client,
        productId,
        true,
      );

      const image = await this.ensureImage(
        client,
        productId,
        imageId,
      );

      await client.query(
        `DELETE FROM product_images
         WHERE id = $1
           AND product_id = $2`,
        [imageId, productId],
      );

      let replacementId: string | null = null;

      // If the featured image was removed,
      // feature the next available image.
      if (image.is_featured) {
        const replacement = await client.query<{
          id: string;
        }>(
          `SELECT id
           FROM product_images
           WHERE product_id = $1
           ORDER BY position, created_at, id
           LIMIT 1`,
          [productId],
        );

        replacementId =
          replacement.rows[0]?.id ?? null;

        if (replacementId) {
          await client.query(
            `UPDATE product_images
             SET is_featured = true
             WHERE id = $1
               AND product_id = $2`,
            [replacementId, productId],
          );
        }
      }

      await this.audit(
        client,
        productId,
        adminId,
        'product.image_removed',
        {
          imageId,
          mediaId: image.media_id,
          variantId: image.variant_id,
          wasFeatured: image.is_featured,
          replacementId,
          mediaFileDeleted: false,
        },
      );

      return {
        imageId,
        removed: true,
        mediaDeleted: false,
        replacementId,
        gallery: await this.gallery(
          client,
          productId,
        ),
      };
    });
  }

  // ========================================
  // REORDER ALL GALLERY IMAGES
  // ========================================

  async reorder(
    productId: string,
    input: ReorderProductImagesInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.ensureProduct(
        client,
        productId,
        true,
      );

      const existing = await client.query<{
        id: string;
        position: number;
      }>(
        `SELECT id, position
         FROM product_images
         WHERE product_id = $1
         ORDER BY position, created_at, id`,
        [productId],
      );

      const oldIds = existing.rows.map(
        (image) => image.id,
      );

      const newIds = input.imageIds;

      if (
        oldIds.length !== newIds.length ||
        newIds.some((id) => !oldIds.includes(id))
      ) {
        throw new BadRequestException({
          success: false,
          message:
            'La liste doit contenir exactement toutes les images du produit.',
        });
      }

      const hasChanges = newIds.some(
        (id, index) => {
          const current = existing.rows.find(
            (row) => row.id === id,
          );

          return current?.position !== index;
        },
      );

      if (!hasChanges) {
        return {
          changed: false,
          gallery: await this.gallery(
            client,
            productId,
          ),
        };
      }

      for (let index = 0; index < newIds.length; index++) {
        await client.query(
          `UPDATE product_images
           SET position = $3
           WHERE id = $1
             AND product_id = $2`,
          [
            newIds[index],
            productId,
            index,
          ],
        );
      }

      await this.audit(
        client,
        productId,
        adminId,
        'product.images_reordered',
        {
          previousOrder: oldIds,
          newOrder: newIds,
        },
      );

      return {
        changed: true,
        gallery: await this.gallery(
          client,
          productId,
        ),
      };
    });
  }
}
