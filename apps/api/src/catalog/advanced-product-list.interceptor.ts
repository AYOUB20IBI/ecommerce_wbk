
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { from, type Observable } from 'rxjs';
import { z } from 'zod';

const priceSchema = z.string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    'Prix invalide.',
  );

const schema = z.strictObject({
  page: z.coerce.number()
    .int()
    .min(1)
    .max(100000)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  status: z.enum([
    'draft',
    'published',
    'private',
    'archived',
  ]).optional(),

  type: z.enum([
    'simple',
    'variable',
  ]).optional(),

  search: z.string()
    .trim()
    .max(100)
    .optional(),

  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  tagId: z.uuid().optional(),

  attributeId: z.uuid().optional(),
  valueId: z.uuid().optional(),

  minPrice: priceSchema.optional(),
  maxPrice: priceSchema.optional(),

  stockStatus: z.enum([
    'instock',
    'outofstock',
  ]).optional(),

  isFeatured: z.enum([
    'true',
    'false',
  ]).optional(),

  trash: z.enum([
    'active',
    'trash',
    'all',
  ]).default('active'),

  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'name',
    'price',
  ]).default('createdAt'),

  sortOrder: z.enum([
    'asc',
    'desc',
  ]).default('desc'),
}).superRefine((data, ctx) => {
  if (
    data.attributeId !== undefined &&
    data.valueId === undefined
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['valueId'],
      message:
        'valueId est obligatoire avec attributeId.',
    });
  }

  if (
    data.valueId !== undefined &&
    data.attributeId === undefined
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['attributeId'],
      message:
        'attributeId est obligatoire avec valueId.',
    });
  }

  if (
    data.minPrice !== undefined &&
    data.maxPrice !== undefined &&
    Number(data.minPrice) > Number(data.maxPrice)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['maxPrice'],
      message:
        'Le prix maximum doit être supérieur au minimum.',
    });
  }
});

type Input = z.infer<typeof schema>;

type DatabaseRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  isFeatured: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  sku: string | null;
  regularPrice: string | null;
  stockQuantity: number | null;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  imageId: string | null;
  imageMediaId: string | null;
  imageVariantId: string | null;
  imagePosition: number | null;
  imageSourceType: string | null;
  imageStorageProvider: string | null;
  imageStorageKey: string | null;
  imageExternalUrl: string | null;
  imageOriginalName: string | null;
  imageAltText: string | null;
  isDeleted: boolean;
  minPrice: string | null;
  maxPrice: string | null;
  totalStock: number;
  variantsCount: number;
};

@Injectable()
export class AdvancedProductListInterceptor
  implements NestInterceptor {
  constructor(
    @Inject('ADVANCED_PRODUCT_LIST_POOL')
    private readonly pool: Pool,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest>();

    const path = request.url.split('?')[0]
      .replace(/\/+$/, '');

    if (
      request.method !== 'GET' ||
      path !== '/api/v1/admin/products'
    ) {
      return next.handle();
    }

    // Existing NestJS guards execute before
    // this interceptor, including RBAC.
    return from(this.findAll(request.query));
  }

  private validate(query: unknown): Input {
    const result = schema.safeParse(query);

    if (result.success) {
      return result.data;
    }

    const errors: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'query';
      (errors[field] ??= []).push(issue.message);
    }

    throw new BadRequestException({
      success: false,
      message:
        'Les paramètres de recherche sont invalides.',
      errors,
    });
  }

  private async findAll(query: unknown) {
    const input = this.validate(query);

    const params: unknown[] = [];
    const conditions: string[] = [];

    const add = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (input.status) {
      conditions.push(
        `p.status::text = ${add(input.status)}`,
      );
    }

    if (input.type) {
      conditions.push(
        `p.type::text = ${add(input.type)}`,
      );
    }

    if (input.trash === 'active') {
      conditions.push(`
        NOT EXISTS (
          SELECT 1
          FROM product_deletion_state ds
          WHERE ds.product_id = p.id
        )
      `);
    } else if (input.trash === 'trash') {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_deletion_state ds
          WHERE ds.product_id = p.id
        )
      `);
    }

    if (input.search) {
      const term = add(
        input.search.toLowerCase(),
      );

      conditions.push(`
        (
          strpos(lower(p.name), ${term}) > 0
          OR strpos(lower(p.slug), ${term}) > 0
          OR EXISTS (
            SELECT 1
            FROM product_variants search_v
            WHERE search_v.product_id = p.id
              AND (
                strpos(
                  lower(search_v.sku),
                  ${term}
                ) > 0
                OR strpos(
                  lower(search_v.ean),
                  ${term}
                ) > 0
              )
          )
        )
      `);
    }

    if (input.categoryId) {
      const id = add(input.categoryId);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_categories pc
          WHERE pc.product_id = p.id
            AND pc.category_id = ${id}::uuid
        )
      `);
    }

    if (input.brandId) {
      const id = add(input.brandId);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_brands pb_filter
          WHERE pb_filter.product_id = p.id
            AND pb_filter.brand_id = ${id}::uuid
        )
      `);
    }

    if (input.tagId) {
      const id = add(input.tagId);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_tags pt
          WHERE pt.product_id = p.id
            AND pt.tag_id = ${id}::uuid
        )
      `);
    }

    if (input.isFeatured !== undefined) {
      const featured = add(
        input.isFeatured === 'true',
      );

      conditions.push(
        `p.is_featured = ${featured}::boolean`,
      );
    }

    // All variant-based filters must match
    // the SAME variation.
    const variantConditions: string[] = [];

    if (input.minPrice !== undefined) {
      const price = add(input.minPrice);

      variantConditions.push(`
        COALESCE(
          fv.sale_price,
          fv.regular_price
        ) >= ${price}::numeric
      `);
    }

    if (input.maxPrice !== undefined) {
      const price = add(input.maxPrice);

      variantConditions.push(`
        COALESCE(
          fv.sale_price,
          fv.regular_price
        ) <= ${price}::numeric
      `);
    }

    if (input.attributeId && input.valueId) {
      const attributeId = add(input.attributeId);
      const valueId = add(input.valueId);

      variantConditions.push(`
        EXISTS (
          SELECT 1
          FROM variant_attribute_values vav
          WHERE vav.variant_id = fv.id
            AND vav.attribute_id =
              ${attributeId}::uuid
            AND vav.value_id =
              ${valueId}::uuid
        )
      `);
    }

    const sellableVariant = `
      fv.is_active = true
      AND fv.regular_price IS NOT NULL
    `;

    const inStockCondition = `
      (
        fv.manage_stock = false
        OR fv.stock_quantity > 0
      )
    `;

    const outOfStockCondition = `
      fv.manage_stock = true
      AND fv.stock_quantity <= 0
    `;

    if (
      input.stockStatus === 'instock'
    ) {
      variantConditions.push(inStockCondition);
    }

    const hasVariantFilters =
      variantConditions.length > 0;

    // Out of stock means NO sellable variation
    // with available stock.
    if (input.stockStatus === 'outofstock') {
      conditions.push(`
        NOT EXISTS (
          SELECT 1
          FROM product_variants fv
          WHERE fv.product_id = p.id
            AND ${sellableVariant}
            AND ${inStockCondition}
        )
      `);

      // Other variant filters should still
      // apply to the same active variation.
      if (
        input.minPrice !== undefined ||
        input.maxPrice !== undefined ||
        input.attributeId !== undefined
      ) {
        const priceAndAttributeConditions =
          variantConditions.filter(
            (condition) =>
              condition !== outOfStockCondition,
          );

        if (priceAndAttributeConditions.length) {
          conditions.push(`
            EXISTS (
              SELECT 1
              FROM product_variants fv
              WHERE fv.product_id = p.id
                AND ${sellableVariant}
                AND ${priceAndAttributeConditions.join(
                  ' AND ',
                )}
            )
          `);
        }
      }
    } else if (hasVariantFilters) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_variants fv
          WHERE fv.product_id = p.id
            AND ${sellableVariant}
            AND ${variantConditions.join(' AND ')}
        )
      `);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sortColumns: Record<
      Input['sortBy'],
      string
    > = {
      createdAt: 'p.created_at',
      updatedAt: 'p.updated_at',
      name: 'lower(p.name)',
      price: 'pricing.min_price',
    };

    const sortColumn =
      sortColumns[input.sortBy];

    const sortDirection =
      input.sortOrder === 'asc'
        ? 'ASC'
        : 'DESC';

    const priceNullOrder =
      input.sortBy === 'price'
        ? ' NULLS LAST'
        : '';

    const offset =
      (input.page - 1) * input.limit;

    // Reuse the same bound parameters
    // in the COUNT and ITEMS queries.
    const filterParams = [...params];

    const totalResult = await this.pool.query<{
      total: string;
    }>(
      `
        SELECT COUNT(*)::bigint AS total
        FROM products p
        ${where}
      `,
      filterParams,
    );

    const total = Number(
      totalResult.rows[0]?.total ?? 0,
    );

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;

    const result = await this.pool.query<DatabaseRow>(
      `
        SELECT
          p.id,
          p.name,
          p.slug,
          p.type::text AS type,
          p.status::text AS status,
          p.is_featured AS "isFeatured",
          p.created_by AS "createdBy",
          p.updated_by AS "updatedBy",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",

          dv.sku,
          dv.regular_price AS "regularPrice",
          dv.stock_quantity AS "stockQuantity",

          b.id AS "brandId",
          b.name AS "brandName",
          b.slug AS "brandSlug",

          img.id AS "imageId",
          img.media_id AS "imageMediaId",
          img.variant_id AS "imageVariantId",
          img.position AS "imagePosition",

          m.source_type::text
            AS "imageSourceType",
          m.storage_provider::text
            AS "imageStorageProvider",
          m.storage_key AS "imageStorageKey",
          m.external_url AS "imageExternalUrl",
          m.original_name AS "imageOriginalName",
          m.alt_text AS "imageAltText",

          EXISTS (
            SELECT 1
            FROM product_deletion_state ds
            WHERE ds.product_id = p.id
          ) AS "isDeleted",

          pricing.min_price::text AS "minPrice",
          pricing.max_price::text AS "maxPrice",
          pricing.total_stock AS "totalStock",
          pricing.variants_count AS "variantsCount"

        FROM products p

        LEFT JOIN LATERAL (
          SELECT
            v.sku,
            v.regular_price,
            v.stock_quantity
          FROM product_variants v
          WHERE v.product_id = p.id
            AND v.is_default = true
          ORDER BY v.position, v.id
          LIMIT 1
        ) dv ON TRUE

        LEFT JOIN product_brands pb
          ON pb.product_id = p.id

        LEFT JOIN brands b
          ON b.id = pb.brand_id

        LEFT JOIN LATERAL (
          SELECT
            pi.id,
            pi.media_id,
            pi.variant_id,
            pi.position
          FROM product_images pi
          WHERE pi.product_id = p.id
            AND pi.is_featured = true
          LIMIT 1
        ) img ON TRUE

        LEFT JOIN media m
          ON m.id = img.media_id

        LEFT JOIN LATERAL (
          SELECT
            MIN(
              COALESCE(
                v.sale_price,
                v.regular_price
              )
            ) FILTER (
              WHERE v.is_active = true
                AND v.regular_price IS NOT NULL
            ) AS min_price,

            MAX(
              COALESCE(
                v.sale_price,
                v.regular_price
              )
            ) FILTER (
              WHERE v.is_active = true
                AND v.regular_price IS NOT NULL
            ) AS max_price,

            COALESCE(
              SUM(v.stock_quantity) FILTER (
                WHERE v.is_active = true
                  AND v.manage_stock = true
              ),
              0
            )::int AS total_stock,

            COUNT(*)::int AS variants_count

          FROM product_variants v
          WHERE v.product_id = p.id
        ) pricing ON TRUE

        ${where}

        ORDER BY
          ${sortColumn} ${sortDirection}
          ${priceNullOrder},
          p.id ${sortDirection}

        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      [...params, input.limit, offset],
    );

    const items = result.rows.map((row) => {
      const {
        brandId,
        brandName,
        brandSlug,
        imageId,
        imageMediaId,
        imageVariantId,
        imagePosition,
        imageSourceType,
        imageStorageProvider,
        imageStorageKey,
        imageExternalUrl,
        imageOriginalName,
        imageAltText,
        ...product
      } = row;

      return {
        ...product,

        brand: brandId
          ? {
              id: brandId,
              name: brandName,
              slug: brandSlug,
            }
          : null,

        featuredImage: imageId
          ? {
              id: imageId,
              mediaId: imageMediaId,
              variantId: imageVariantId,
              position: imagePosition,
              sourceType: imageSourceType,
              storageProvider:
                imageStorageProvider,
              storageKey: imageStorageKey,
              externalUrl: imageExternalUrl,
              originalName: imageOriginalName,
              altText: imageAltText,
            }
          : null,
      };
    });

    return {
      success: true,
      message:
        'Produits récupérés avec succès.',
      data: {
        items,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(
            total / input.limit,
          ),
        },
      },
    };
  }
}
