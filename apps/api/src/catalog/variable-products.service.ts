
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Pool, PoolClient } from 'pg';

import { buildCombinationKey } from './utils/variant-combination';

import type {
  CreateVariantInput,
  UpdateVariantInput,
  UpdateVariableProductInput,
} from './dto/variable-product.dto';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  description: string | null;
  short_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string | null;
  ean: string | null;
  regular_price: string | null;
  sale_price: string | null;
  stock_quantity: number;
  manage_stock: boolean;
  is_active: boolean;
  is_default: boolean;
  position: number;
  combination_key: string | null;
};

type Option = {
  attributeId: string;
  valueId: string;
};

type VariantDetails = VariantRow & {
  options: Option[];
};

type Changes = Record<string, unknown>;

const PRODUCT_FIELDS: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  status: 'status',
  description: 'description',
  shortDescription: 'short_description',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
  isFeatured: 'is_featured',
};

const VARIANT_FIELDS: Record<string, string> = {
  sku: 'sku',
  ean: 'ean',
  regularPrice: 'regular_price',
  salePrice: 'sale_price',
  stockQuantity: 'stock_quantity',
  manageStock: 'manage_stock',
  isActive: 'is_active',
};

function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');

  return BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

@Injectable()
export class VariableProductsService {
  constructor(
    @Inject('VARIABLE_PRODUCTS_POOL')
    private readonly pool: Pool,
  ) {}

  // ==========================================
  // DATABASE ERRORS
  // ==========================================

  private handleError(error: unknown): never {
    let current: unknown = error;

    while (current && typeof current === 'object') {
      const e = current as {
        code?: string;
        constraint?: string;
        cause?: unknown;
      };

      if (e.code === '23505') {
        const constraint = e.constraint ?? '';

        const field = constraint.includes('sku')
          ? 'sku'
          : constraint.includes('ean')
          ? 'ean'
          : constraint.includes('slug')
          ? 'slug'
          : constraint.includes('combination')
          ? 'options'
          : 'variant';

        throw new ConflictException({
          success: false,
          message: 'Une valeur existe déjà.',
          errors: {
            [field]: ['Cette valeur est déjà utilisée.'],
          },
        });
      }

      if (e.code === '23503' || e.code === '23514') {
        throw new BadRequestException({
          success: false,
          message:
            'Les données ne respectent pas les contraintes.',
        });
      }

      current = e.cause;
    }

    throw error;
  }

  // ==========================================
  // TRANSACTIONS
  // ==========================================

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
        // Preserve the original error.
      }

      this.handleError(error);
    } finally {
      client.release();
    }
  }

  // ==========================================
  // VERIFY PRODUCT
  // ==========================================

  private async product(
    client: PoolClient,
    productId: string,
    lock = false,
  ): Promise<ProductRow> {
    const result = await client.query<ProductRow>(
      `SELECT *
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

    if (product.type !== 'variable') {
      throw new BadRequestException({
        success: false,
        message:
          'Cette opération est réservée aux produits variables.',
      });
    }

    return product;
  }

  // ==========================================
  // VERIFY VARIANT
  // ==========================================

  private async variant(
    client: PoolClient,
    productId: string,
    variantId: string,
    lock = false,
  ): Promise<VariantRow> {
    const result = await client.query<VariantRow>(
      `SELECT *
       FROM product_variants
       WHERE id = $1
         AND product_id = $2
       ${lock ? 'FOR UPDATE' : ''}
       LIMIT 1`,
      [variantId, productId],
    );

    const variant = result.rows[0];

    if (!variant) {
      throw new NotFoundException({
        success: false,
        message: 'Variation introuvable.',
      });
    }

    return variant;
  }

  // ==========================================
  // READ OPTIONS
  // ==========================================

  private async readOptions(
    client: PoolClient,
    variantId: string,
  ): Promise<Option[]> {
    const result = await client.query<{
      attribute_id: string;
      value_id: string;
    }>(
      `SELECT attribute_id, value_id
       FROM variant_attribute_values
       WHERE variant_id = $1
       ORDER BY attribute_id`,
      [variantId],
    );

    return result.rows.map((row) => ({
      attributeId: row.attribute_id,
      valueId: row.value_id,
    }));
  }

  // ==========================================
  // READ VARIANTS
  // ==========================================

  private async readVariants(
    client: PoolClient,
    productId: string,
  ): Promise<VariantDetails[]> {
    const result = await client.query<VariantRow>(
      `SELECT *
       FROM product_variants
       WHERE product_id = $1
       ORDER BY position ASC, id ASC`,
      [productId],
    );

    const variantIds = result.rows.map((row) => row.id);

    if (!variantIds.length) return [];

    const optionsResult = await client.query<{
      variant_id: string;
      attribute_id: string;
      value_id: string;
    }>(
      `SELECT variant_id, attribute_id, value_id
       FROM variant_attribute_values
       WHERE variant_id = ANY($1::uuid[])
       ORDER BY attribute_id`,
      [variantIds],
    );

    const optionsByVariant = new Map<string, Option[]>();

    for (const row of optionsResult.rows) {
      const options = optionsByVariant.get(row.variant_id) ?? [];

      options.push({
        attributeId: row.attribute_id,
        valueId: row.value_id,
      });

      optionsByVariant.set(row.variant_id, options);
    }

    return result.rows.map((row) => ({
      ...row,
      options: optionsByVariant.get(row.id) ?? [],
    }));
  }

  // ==========================================
  // VALIDATE ATTRIBUTES AND VALUES
  // ==========================================

  private async validateOptions(
    client: PoolClient,
    productId: string,
    options: Option[],
  ): Promise<string> {
    const allowedAttributes = await client.query<{
      attribute_id: string;
    }>(
      `SELECT attribute_id
       FROM product_attributes
       WHERE product_id = $1
         AND used_for_variations = true`,
      [productId],
    );

    const attributeIds = new Set(
      allowedAttributes.rows.map((row) => row.attribute_id),
    );

    const suppliedIds = new Set(
      options.map((option) => option.attributeId),
    );

    if (
      attributeIds.size === 0 ||
      suppliedIds.size !== attributeIds.size ||
      options.length !== attributeIds.size ||
      [...suppliedIds].some((id) => !attributeIds.has(id))
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Combinaison invalide.',
        errors: {
          options: [
            'Chaque attribut de variation doit avoir une valeur.',
          ],
        },
      });
    }

    const allowedValues = await client.query<{
      attribute_id: string;
      value_id: string;
    }>(
      `SELECT attribute_id, value_id
       FROM product_attribute_values
       WHERE product_id = $1`,
      [productId],
    );

    const allowedPairs = new Set(
      allowedValues.rows.map(
        (row) => `${row.attribute_id}:${row.value_id}`,
      ),
    );

    for (const option of options) {
      const pair =
        `${option.attributeId}:${option.valueId}`;

      if (!allowedPairs.has(pair)) {
        throw new BadRequestException({
          success: false,
          message: "Valeur d'attribut invalide.",
          errors: {
            options: [
              "La valeur n'est pas autorisée pour ce produit.",
            ],
          },
        });
      }
    }

    return buildCombinationKey(options);
  }

  // ==========================================
  // CHECK PRICE VALIDITY
  // ==========================================

  private validatePrices(
    regular: string | null,
    sale: string | null,
  ): void {
    if (sale === null) return;

    if (
      regular === null ||
      toCents(sale) > toCents(regular)
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Prix promotionnel invalide.',
        errors: {
          salePrice: [
            'Le prix promotionnel dépasse le prix normal.',
          ],
        },
      });
    }
  }

  // ==========================================
  // CHECK PUBLISHED PRODUCT
  // ==========================================

  private async ensurePublishable(
    client: PoolClient,
    productId: string,
  ): Promise<void> {
    const result = await client.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM product_variants
       WHERE product_id = $1
         AND is_active = true
         AND regular_price IS NOT NULL`,
      [productId],
    );

    if ((result.rows[0]?.total ?? 0) < 1) {
      throw new ConflictException({
        success: false,
        message:
          'Le produit publié doit avoir au moins une variation active avec un prix.',
      });
    }
  }

  // ==========================================
  // AUDIT
  // ==========================================

  private async audit(
    client: PoolClient,
    productId: string,
    adminId: string,
    action: string,
    changes: Changes,
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

    await client.query(
      `UPDATE products
       SET updated_by = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [productId, adminId],
    );
  }

  // ==========================================
  // GET VARIANTS
  // ==========================================

  async findAll(productId: string) {
    const client = await this.pool.connect();

    try {
      await this.product(client, productId);

      return await this.readVariants(client, productId);
    } finally {
      client.release();
    }
  }

  // ==========================================
  // CREATE VARIANT
  // ==========================================

  async create(
    productId: string,
    input: CreateVariantInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      const product = await this.product(
        client,
        productId,
        true,
      );

      const combinationKey = await this.validateOptions(
        client,
        productId,
        input.options,
      );

      this.validatePrices(
        input.regularPrice,
        input.salePrice ?? null,
      );

      if (
        product.status === 'published' &&
        input.isActive &&
        input.regularPrice === null
      ) {
        throw new BadRequestException({
          success: false,
          message:
            'Une variation active publiée nécessite un prix.',
        });
      }

      const duplicate = await client.query(
        `SELECT 1
         FROM product_variants
         WHERE product_id = $1
           AND combination_key = $2
         LIMIT 1`,
        [productId, combinationKey],
      );

      if (duplicate.rows.length) {
        throw new ConflictException({
          success: false,
          message:
            'Cette combinaison existe déjà.',
        });
      }

      const positionResult = await client.query<{
        next_position: number;
      }>(
        `SELECT COALESCE(MAX(position), -1) + 1
           AS next_position
         FROM product_variants
         WHERE product_id = $1`,
        [productId],
      );

      const position =
        positionResult.rows[0]?.next_position ?? 0;

      const created = await client.query<VariantRow>(
        `INSERT INTO product_variants (
           product_id,
           sku,
           ean,
           regular_price,
           sale_price,
           stock_quantity,
           manage_stock,
           is_active,
           is_default,
           position,
           combination_key
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, false, $9, $10
         )
         RETURNING *`,
        [
          productId,
          input.sku ?? null,
          input.ean ?? null,
          input.regularPrice,
          input.salePrice ?? null,
          input.stockQuantity,
          input.manageStock,
          input.isActive,
          position,
          combinationKey,
        ],
      );

      const variant = created.rows[0];

      for (const option of input.options) {
        await client.query(
          `INSERT INTO variant_attribute_values (
             variant_id, attribute_id, value_id
           )
           VALUES ($1, $2, $3)`,
          [
            variant.id,
            option.attributeId,
            option.valueId,
          ],
        );
      }

      await this.audit(
        client,
        productId,
        adminId,
        'variant.created',
        {
          variantId: variant.id,
          sku: variant.sku,
          options: input.options,
          regularPrice: variant.regular_price,
          stockQuantity: variant.stock_quantity,
        },
      );

      return {
        ...variant,
        options: input.options,
      };
    });
  }

  // ==========================================
  // UPDATE VARIANT
  // ==========================================

  async update(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      const product = await this.product(
        client,
        productId,
        true,
      );

      const previous = await this.variant(
        client,
        productId,
        variantId,
        true,
      );

      const previousOptions = await this.readOptions(
        client,
        variantId,
      );

      const regularPrice =
        input.regularPrice === undefined
          ? previous.regular_price
          : input.regularPrice;

      const salePrice =
        input.salePrice === undefined
          ? previous.sale_price
          : input.salePrice;

      const isActive =
        input.isActive ?? previous.is_active;

      this.validatePrices(regularPrice, salePrice);

      if (
        product.status === 'published' &&
        isActive &&
        regularPrice === null
      ) {
        throw new BadRequestException({
          success: false,
          message:
            'Une variation active publiée nécessite un prix.',
        });
      }

      const patch: Record<string, unknown> = {};

      for (const [key, column] of
        Object.entries(VARIANT_FIELDS)) {
        const value = (
          input as Record<string, unknown>
        )[key];

        if (value !== undefined) {
          patch[column] = value;
        }
      }

      let combinationKey = previous.combination_key;

      if (input.options !== undefined) {
        combinationKey = await this.validateOptions(
          client,
          productId,
          input.options,
        );

        patch.combination_key = combinationKey;
      }

      const changes: Changes = {};

      for (const [column, value] of
        Object.entries(patch)) {
        const previousValue = (
          previous as unknown as Record<string, unknown>
        )[column];

        if (!sameValue(previousValue, value)) {
          changes[column] = {
            old: previousValue ?? null,
            new: value,
          };
        }
      }

      if (
        input.options !== undefined &&
        !sameValue(
          [...previousOptions].sort(
            (a, b) =>
              a.attributeId.localeCompare(b.attributeId),
          ),
          [...input.options].sort(
            (a, b) =>
              a.attributeId.localeCompare(b.attributeId),
          ),
        )
      ) {
        changes.options = {
          old: previousOptions,
          new: input.options,
        };
      }

      if (Object.keys(changes).length === 0) {
        return {
          ...previous,
          options: previousOptions,
        };
      }

      const entries = Object.entries(patch);

      if (entries.length) {
        const assignments = entries.map(
          ([column], i) => `${column} = $${i + 3}`,
        );

        await client.query(
          `UPDATE product_variants
           SET ${assignments.join(', ')},
               updated_at = NOW()
           WHERE id = $1 AND product_id = $2`,
          [
            variantId,
            productId,
            ...entries.map(([, value]) => value),
          ],
        );
      }

      if (input.options !== undefined) {
        await client.query(
          `DELETE FROM variant_attribute_values
           WHERE variant_id = $1`,
          [variantId],
        );

        for (const option of input.options) {
          await client.query(
            `INSERT INTO variant_attribute_values
               (variant_id, attribute_id, value_id)
             VALUES ($1, $2, $3)`,
            [
              variantId,
              option.attributeId,
              option.valueId,
            ],
          );
        }
      }

      if (product.status === 'published') {
        await this.ensurePublishable(
          client,
          productId,
        );
      }

      await this.audit(
        client,
        productId,
        adminId,
        'variant.updated',
        {
          variantId,
          changes,
        },
      );

      const updated = await this.variant(
        client,
        productId,
        variantId,
      );

      return {
        ...updated,
        options:
          input.options ?? previousOptions,
      };
    });
  }

  // ==========================================
  // CHANGE DEFAULT VARIANT
  // ==========================================

  async setDefault(
    productId: string,
    variantId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      await this.product(
        client,
        productId,
        true,
      );

      const selected = await this.variant(
        client,
        productId,
        variantId,
      );

      if (!selected.is_active) {
        throw new BadRequestException({
          success: false,
          message:
            'Une variation inactive ne peut pas être définie par défaut.',
        });
      }

      const oldDefault = await client.query<{
        id: string;
      }>(
        `SELECT id
         FROM product_variants
         WHERE product_id = $1
           AND is_default = true
         LIMIT 1`,
        [productId],
      );

      const oldDefaultId =
        oldDefault.rows[0]?.id ?? null;

      if (oldDefaultId === variantId) {
        return {
          variantId,
          changed: false,
        };
      }

      await client.query(
        `UPDATE product_variants
         SET is_default = false,
             updated_at = NOW()
         WHERE product_id = $1
           AND is_default = true`,
        [productId],
      );

      await client.query(
        `UPDATE product_variants
         SET is_default = true,
             updated_at = NOW()
         WHERE id = $1 AND product_id = $2`,
        [variantId, productId],
      );

      await this.audit(
        client,
        productId,
        adminId,
        'variant.default_changed',
        {
          previousDefaultId: oldDefaultId,
          newDefaultId: variantId,
        },
      );

      return {
        variantId,
        changed: true,
      };
    });
  }

  // ==========================================
  // SAFE DELETE (DEACTIVATE)
  // ==========================================

  async remove(
    productId: string,
    variantId: string,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      const product = await this.product(
        client,
        productId,
        true,
      );

      const selected = await this.variant(
        client,
        productId,
        variantId,
        true,
      );

      if (selected.is_default) {
        throw new ConflictException({
          success: false,
          message:
            'Changez la variation par défaut avant de la désactiver.',
        });
      }

      if (!selected.is_active) {
        return {
          variantId,
          deleted: false,
          alreadyInactive: true,
        };
      }

      await client.query(
        `UPDATE product_variants
         SET is_active = false,
             updated_at = NOW()
         WHERE id = $1 AND product_id = $2`,
        [variantId, productId],
      );

      if (product.status === 'published') {
        await this.ensurePublishable(
          client,
          productId,
        );
      }

      await this.audit(
        client,
        productId,
        adminId,
        'variant.deactivated',
        {
          variantId,
          sku: selected.sku,
          isActive: {
            old: true,
            new: false,
          },
        },
      );

      return {
        variantId,
        deleted: true,
        softDelete: true,
      };
    });
  }

  // ==========================================
  // UPDATE VARIABLE PRODUCT
  // ==========================================

  async updateProduct(
    productId: string,
    input: UpdateVariableProductInput,
    adminId: string,
  ) {
    return this.transaction(async (client) => {
      const previous = await this.product(
        client,
        productId,
        true,
      );

      const patch: Record<string, unknown> = {};

      for (const [field, column] of
        Object.entries(PRODUCT_FIELDS)) {
        const value = (
          input as Record<string, unknown>
        )[field];

        if (value !== undefined) {
          patch[column] = value;
        }
      }

      const changes: Changes = {};

      for (const [column, value] of
        Object.entries(patch)) {
        const oldValue = (
          previous as unknown as Record<string, unknown>
        )[column];

        if (!sameValue(oldValue, value)) {
          changes[column] = {
            old: oldValue ?? null,
            new: value,
          };
        }
      }

      if (!Object.keys(changes).length) {
        return previous;
      }

      if (
        input.status === 'published' &&
        previous.status !== 'published'
      ) {
        await this.ensurePublishable(
          client,
          productId,
        );
      }

      const entries = Object.entries(patch);

      const assignments = entries.map(
        ([column], i) => `${column} = $${i + 2}`,
      );

      const updated = await client.query<ProductRow>(
        `UPDATE products
         SET ${assignments.join(', ')},
             updated_by = $${entries.length + 2},
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          productId,
          ...entries.map(([, value]) => value),
          adminId,
        ],
      );

      await this.audit(
        client,
        productId,
        adminId,
        'product.variable_updated',
        changes,
      );

      return updated.rows[0];
    });
  }
}
