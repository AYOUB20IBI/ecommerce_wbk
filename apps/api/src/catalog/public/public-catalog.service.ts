
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Inject } from '@nestjs/common';
import type { Pool } from 'pg';

import type {
  PublicCatalogQuery,
  PublicTaxonomyQuery,
} from './dto/public-catalog.dto';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  createdAt: Date;
  minPrice: string | null;
  maxPrice: string | null;
  inStock: boolean;
  brand: unknown;
  featuredImage: unknown;
};

type CountRow = {
  total: string;
};

@Injectable()
export class PublicCatalogService {
  constructor(
    @Inject('PUBLIC_CATALOG_POOL')
    private readonly pool: Pool,
  ) {}

  // ========================================
  // SHARED PUBLIC PRODUCT CONDITIONS
  // ========================================

  private readonly visibility = `
    p.status = 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM product_deletion_state ds
      WHERE ds.product_id = p.id
    )
  `;

  private readonly priceExpression = `
    COALESCE(v.sale_price, v.regular_price)
  `;

  private readonly availableStock = `
    (
      v.manage_stock = false
      OR v.stock_quantity > 0
    )
  `;

  // ========================================
  // SAFE FILTER BUILDER
  // ========================================

  private buildFilters(
    input: PublicCatalogQuery,
    featuredOnly: boolean,
  ) {
    const params: unknown[] = [];
    const conditions: string[] = [
      this.visibility,
    ];

    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (featuredOnly) {
      conditions.push('p.is_featured = true');
    }

    if (input.search) {
      const search = add(input.search.toLowerCase());

      conditions.push(`
        (
          strpos(lower(p.name), ${search}) > 0
          OR strpos(lower(p.slug), ${search}) > 0
          OR EXISTS (
            SELECT 1
            FROM product_variants sv
            WHERE sv.product_id = p.id
              AND sv.is_active = true
              AND (
                strpos(lower(sv.sku), ${search}) > 0
                OR strpos(lower(sv.ean), ${search}) > 0
              )
          )
        )
      `);
    }

    if (input.category) {
      const slug = add(input.category);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_categories pc
          INNER JOIN categories c
            ON c.id = pc.category_id
          WHERE pc.product_id = p.id
            AND c.slug = ${slug}
            AND c.is_active = true
        )
      `);
    }

    if (input.brand) {
      const slug = add(input.brand);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_brands pb
          INNER JOIN brands b
            ON b.id = pb.brand_id
          WHERE pb.product_id = p.id
            AND b.slug = ${slug}
        )
      `);
    }

    if (input.tag) {
      const slug = add(input.tag);

      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_tags pt
          INNER JOIN tags t
            ON t.id = pt.tag_id
          WHERE pt.product_id = p.id
            AND t.slug = ${slug}
        )
      `);
    }

    const variantConditions: string[] = [
      'v.product_id = p.id',
      'v.is_active = true',
      'v.regular_price IS NOT NULL',
    ];

    if (input.minPrice !== undefined) {
      const price = add(input.minPrice);

      variantConditions.push(`
        ${this.priceExpression} >= ${price}::numeric
      `);
    }

    if (input.maxPrice !== undefined) {
      const price = add(input.maxPrice);

      variantConditions.push(`
        ${this.priceExpression} <= ${price}::numeric
      `);
    }

    if (input.attributeId && input.valueId) {
      const attribute = add(input.attributeId);
      const value = add(input.valueId);

      variantConditions.push(`
        EXISTS (
          SELECT 1
          FROM variant_attribute_values vav
          WHERE vav.variant_id = v.id
            AND vav.attribute_id = ${attribute}::uuid
            AND vav.value_id = ${value}::uuid
        )
      `);
    }

    if (input.inStock === 'true') {
      variantConditions.push(
        this.availableStock,
      );
    }

    const needsVariantFilter =
      input.minPrice !== undefined ||
      input.maxPrice !== undefined ||
      input.attributeId !== undefined ||
      input.inStock === 'true';

    if (needsVariantFilter) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM product_variants v
          WHERE ${variantConditions.join(' AND ')}
        )
      `);
    }

    if (input.inStock === 'false') {
      conditions.push(`
        NOT EXISTS (
          SELECT 1
          FROM product_variants v
          WHERE v.product_id = p.id
            AND v.is_active = true
            AND v.regular_price IS NOT NULL
            AND ${this.availableStock}
        )
      `);
    }

    return {
      where: conditions.join(' AND '),
      params,
    };
  }

  // ========================================
  // SORTING
  // ========================================

  private buildSort(
    input: PublicCatalogQuery,
  ): string {
    const direction =
      input.sortOrder ??
      (
        input.sortBy === 'oldest' ||
        input.sortBy === 'name' ||
        input.sortBy === 'price'
          ? 'asc'
          : 'desc'
      );

    const order =
      direction === 'asc'
        ? 'ASC'
        : 'DESC';

    if (input.sortBy === 'price') {
      return `
        pricing.min_price ${order} NULLS LAST,
        p.id ${order}
      `;
    }

    if (input.sortBy === 'name') {
      return `
        lower(p.name) ${order},
        p.id ${order}
      `;
    }

    return `
      p.created_at ${order},
      p.id ${order}
    `;
  }

  // ========================================
  // REUSABLE SELECT
  // ========================================

  private readonly productCardSelect = `
    SELECT
      p.id,
      p.name,
      p.slug,
      p.type::text AS type,
      p.short_description AS "shortDescription",
      p.seo_title AS "seoTitle",
      p.seo_description AS "seoDescription",
      p.is_featured AS "isFeatured",
      p.created_at AS "createdAt",

      pricing.min_price::text AS "minPrice",
      pricing.max_price::text AS "maxPrice",
      pricing.in_stock AS "inStock",

      brand.brand AS brand,
      image.featured_image AS "featuredImage"

    FROM products p

    LEFT JOIN LATERAL (
      SELECT
        MIN(
          COALESCE(v.sale_price, v.regular_price)
        ) AS min_price,

        MAX(
          COALESCE(v.sale_price, v.regular_price)
        ) AS max_price,

        COALESCE(
          BOOL_OR(
            v.manage_stock = false
            OR v.stock_quantity > 0
          ),
          false
        ) AS in_stock

      FROM product_variants v
      WHERE v.product_id = p.id
        AND v.is_active = true
        AND v.regular_price IS NOT NULL
    ) pricing ON true

    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.slug
      ) AS brand
      FROM product_brands pb
      JOIN brands b ON b.id = pb.brand_id
      WHERE pb.product_id = p.id
      LIMIT 1
    ) brand ON true

    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', pi.id,
        'mediaId', m.id,
        'variantId', pi.variant_id,
        'position', pi.position,
        'sourceType', m.source_type::text,
        'externalUrl', m.external_url,
        'originalName', m.original_name,
        'altText', m.alt_text,
        'width', m.width,
        'height', m.height
      ) AS featured_image

      FROM product_images pi
      JOIN media m ON m.id = pi.media_id

      WHERE pi.product_id = p.id
        AND pi.is_featured = true
        AND m.status = 'ready'

      LIMIT 1
    ) image ON true
  `;

  // ========================================
  // LIST PRODUCTS
  // ========================================

  async findAll(
    input: PublicCatalogQuery,
    featuredOnly = false,
  ) {
    const { where, params } = this.buildFilters(
      input,
      featuredOnly,
    );

    const sort = this.buildSort(input);

    const totalResult = await this.pool.query<CountRow>(
      `
        SELECT COUNT(*)::bigint AS total
        FROM products p
        WHERE ${where}
      `,
      params,
    );

    const total = Number(
      totalResult.rows[0]?.total ?? 0,
    );

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const results = await this.pool.query<ProductRow>(
      `
        ${this.productCardSelect}

        WHERE ${where}

        ORDER BY ${sort}

        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      [
        ...params,
        input.limit,
        (input.page - 1) * input.limit,
      ],
    );

    return {
      items: results.rows,

      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(
          total / input.limit,
        ),
      },
    };
  }

  // ========================================
  // PRODUCT DETAILS BY SLUG
  // ========================================

  async findBySlug(slug: string) {
    const productResult = await this.pool.query(
      `
        ${this.productCardSelect}
        WHERE ${this.visibility}
          AND p.slug = $1
        LIMIT 1
      `,
      [slug],
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    // Public details contain descriptions,
    // but never administrative metadata.
    const extra = await this.pool.query<{
      description: string | null;
    }>(
      `SELECT description
       FROM products
       WHERE id = $1`,
      [product.id],
    );

    const categoriesResult = await this.pool.query(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.parent_id AS "parentId"
       FROM product_categories pc
       INNER JOIN categories c
         ON c.id = pc.category_id
       WHERE pc.product_id = $1
         AND c.is_active = true
       ORDER BY c.position, c.name`,
      [product.id],
    );

    const tagsResult = await this.pool.query(
      `SELECT
         t.id,
         t.name,
         t.slug
       FROM product_tags pt
       INNER JOIN tags t
         ON t.id = pt.tag_id
       WHERE pt.product_id = $1
       ORDER BY t.name`,
      [product.id],
    );

    const imagesResult = await this.pool.query(
      `SELECT
         pi.id,
         pi.media_id AS "mediaId",
         pi.variant_id AS "variantId",
         pi.is_featured AS "isFeatured",
         pi.position,

         m.source_type::text AS "sourceType",
         m.external_url AS "externalUrl",
         m.original_name AS "originalName",
         m.alt_text AS "altText",
         m.width,
         m.height

       FROM product_images pi
       INNER JOIN media m
         ON m.id = pi.media_id

       WHERE pi.product_id = $1
         AND m.status = 'ready'

       ORDER BY
         pi.is_featured DESC,
         pi.position ASC,
         pi.id ASC`,
      [product.id],
    );

    // Only active variations with valid pricing.
    const variantsResult = await this.pool.query(
      `SELECT
         v.id,
         v.sku,
         v.ean,
         v.regular_price AS "regularPrice",
         v.sale_price AS "salePrice",
         COALESCE(
           v.sale_price,
           v.regular_price
         ) AS "price",

         v.manage_stock AS "manageStock",

         CASE
           WHEN v.manage_stock = true
           THEN v.stock_quantity
           ELSE NULL
         END AS "stockQuantity",

         (
           v.manage_stock = false
           OR v.stock_quantity > 0
         ) AS "inStock",

         v.is_default AS "isDefault",
         v.position

       FROM product_variants v
       WHERE v.product_id = $1
         AND v.is_active = true
         AND v.regular_price IS NOT NULL
       ORDER BY v.position, v.id`,
      [product.id],
    );

    const variantIds = variantsResult.rows.map(
      (variant) => variant.id as string,
    );

    const optionsResult = variantIds.length
      ? await this.pool.query<{
          variantId: string;
          attributeId: string;
          attributeName: string;
          valueId: string;
          valueName: string;
          valueSlug: string;
        }>(
          `SELECT
             vav.variant_id AS "variantId",
             a.id AS "attributeId",
             a.name AS "attributeName",
             av.id AS "valueId",
             av.name AS "valueName",
             av.slug AS "valueSlug"

           FROM variant_attribute_values vav
           INNER JOIN attributes a
             ON a.id = vav.attribute_id
           INNER JOIN attribute_values av
             ON av.id = vav.value_id

           WHERE vav.variant_id = ANY($1::uuid[])
           ORDER BY a.name, av.name`,
          [variantIds],
        )
      : { rows: [] as Array<{
          variantId: string;
          attributeId: string;
          attributeName: string;
          valueId: string;
          valueName: string;
          valueSlug: string;
        }> };

    const optionsByVariant = new Map<
      string,
      Array<{
        attributeId: string;
        attributeName: string;
        valueId: string;
        valueName: string;
        valueSlug: string;
      }>
    >();

    for (const option of optionsResult.rows) {
      const list = optionsByVariant.get(
        option.variantId,
      ) ?? [];

      list.push({
        attributeId: option.attributeId,
        attributeName: option.attributeName,
        valueId: option.valueId,
        valueName: option.valueName,
        valueSlug: option.valueSlug,
      });

      optionsByVariant.set(
        option.variantId,
        list,
      );
    }

    const imagesByVariant = new Map<
      string,
      unknown[]
    >();

    for (const image of imagesResult.rows) {
      const variantId = image.variantId as
        | string
        | null;

      if (!variantId) continue;

      const list = imagesByVariant.get(
        variantId,
      ) ?? [];

      list.push(image);
      imagesByVariant.set(variantId, list);
    }

    const variants = variantsResult.rows.map(
      (variant) => ({
        ...variant,
        options:
          optionsByVariant.get(
            variant.id as string,
          ) ?? [],
        images:
          imagesByVariant.get(
            variant.id as string,
          ) ?? [],
      }),
    );

    return {
      ...product,
      description:
        extra.rows[0]?.description ?? null,
      categories: categoriesResult.rows,
      tags: tagsResult.rows,
      images: imagesResult.rows,
      variants,
    };
  }

  // ========================================
  // PUBLIC CATEGORIES
  // ========================================

  async findCategories(input: PublicTaxonomyQuery) {
    const offset = (input.page - 1) * input.limit;

    const [items, count] = await Promise.all([
      this.pool.query(
        `SELECT
           id,
           name,
           slug,
           parent_id AS "parentId",
           description,
           image_url AS "imageUrl",
           seo_title AS "seoTitle",
           seo_description AS "seoDescription",
           position

         FROM categories
         WHERE is_active = true

         ORDER BY position, name, id
         LIMIT $1 OFFSET $2`,
        [input.limit, offset],
      ),

      this.pool.query<CountRow>(
        `SELECT COUNT(*)::bigint AS total
         FROM categories
         WHERE is_active = true`,
      ),
    ]);

    const total = Number(count.rows[0]?.total ?? 0);

    return {
      items: items.rows,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(
          total / input.limit,
        ),
      },
    };
  }

  // ========================================
  // PUBLIC BRANDS
  // ========================================

  async findBrands(input: PublicTaxonomyQuery) {
    const offset = (input.page - 1) * input.limit;

    const [items, count] = await Promise.all([
      this.pool.query(
        `SELECT
           id,
           name,
           slug,
           description,
           logo_url AS "logoUrl",
           seo_title AS "seoTitle",
           seo_description AS "seoDescription"

         FROM brands

         ORDER BY name, id
         LIMIT $1 OFFSET $2`,
        [input.limit, offset],
      ),

      this.pool.query<CountRow>(
        `SELECT COUNT(*)::bigint AS total
         FROM brands`,
      ),
    ]);

    const total = Number(count.rows[0]?.total ?? 0);

    return {
      items: items.rows,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(
          total / input.limit,
        ),
      },
    };
  }
}
