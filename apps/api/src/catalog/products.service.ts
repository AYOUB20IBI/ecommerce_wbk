
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// import {
//   and,
//   asc,
//   count,
//   desc,
//   eq,
//   ilike,
//   inArray,
//   or,
//   type SQL,
// } from 'drizzle-orm';

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';

import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';

import {
  products,
  productVariants,
} from '../database/schema/catalog.schema';

import {
  attributes,
  attributeValues,
  productAttributes,
  productAttributeValues,
  variantAttributeValues,
} from '../database/schema/catalog-attributes.schema';

import {
  productActivity,
} from '../database/schema/catalog-activity.schema';

import {
  buildCombinationKey,
} from './utils/variant-combination';

import type {
  CreateProductInput,
  CreateSimpleProductInput,
  CreateVariableProductInput,
  UpdateProductInput,
  ProductListInput,
} from './dto/product.dto';

// ========================================
// ERRORS
// ========================================

function throwProductDbError(error: unknown): never {
  let current: unknown = error;

  while (
    current &&
    typeof current === 'object'
  ) {
    const candidate = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };

    if (candidate.code === '23505') {
      const constraint =
        candidate.constraint ?? '';

      const field =
        constraint.includes('slug') ? 'slug' :
        constraint.includes('sku') ? 'sku' :
        constraint.includes('ean') ? 'ean' :
        constraint.includes('combination') ? 'variants' :
        'product';

      throw new ConflictException({
        success: false,
        message: 'Une valeur existe déjà.',
        errors: {
          [field]: [
            'Cette valeur est déjà utilisée.',
          ],
        },
      });
    }

    if (
      candidate.code === '23514' ||
      candidate.code === '23503'
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Les données ne respectent pas les contraintes.',
      });
    }

    current = candidate.cause;
  }

  throw error;
}

function changesBetween(
  oldData: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const changes: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(patch)) {
    if (
      value !== undefined &&
      oldData[field] !== value
    ) {
      changes[field] = {
        old: oldData[field] ?? null,
        new: value,
      };
    }
  }

  return changes;
}

function toCents(value: string): bigint {
  const [whole, decimals = ''] = value.split('.');
  return BigInt(whole) * 100n +
    BigInt(decimals.padEnd(2, '0'));
}

// ========================================
// PRODUCTS SERVICE
// ========================================

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  // ======================================
  // CREATE: SIMPLE OR VARIABLE
  // ======================================

  async create(
    input: CreateProductInput,
    adminId: string,
  ) {
    if (input.type === 'simple') {
      return this.createSimple(input, adminId);
    }

    return this.createVariable(input, adminId);
  }

  // ======================================
  // CREATE SIMPLE
  // ======================================

  private async createSimple(
    input: CreateSimpleProductInput,
    adminId: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            name: input.name,
            slug: input.slug,
            type: 'simple',
            status: input.status,
            shortDescription:
              input.shortDescription ?? null,
            description:
              input.description ?? null,
            seoTitle: input.seoTitle ?? null,
            seoDescription:
              input.seoDescription ?? null,
            isFeatured: input.isFeatured,
            createdBy: adminId,
            updatedBy: adminId,
          })
          .returning();

        const [variant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: input.variant.sku,
            ean: input.variant.ean,
            regularPrice:
              input.variant.regularPrice,
            salePrice:
              input.variant.salePrice ?? null,
            stockQuantity:
              input.variant.stockQuantity,
            manageStock:
              input.variant.manageStock,
            isActive: input.variant.isActive,
            isDefault: true,
            position: 0,
            combinationKey: null,
          })
          .returning();

        await tx.insert(productActivity).values({
          productId: product.id,
          actorId: adminId,
          action: 'product.created',
          changes: {
            type: 'simple',
            status: product.status,
            variantId: variant.id,
          },
        });

        return {
          ...product,
          variants: [variant],
        };
      });
    } catch (error) {
      throwProductDbError(error);
    }
  }

  // ======================================
  // CREATE VARIABLE
  // ======================================

  private async createVariable(
    input: CreateVariableProductInput,
    adminId: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. Validate global attributes.
        const requestedIds = input.attributes.map(
          (attribute) => attribute.attributeId,
        );

        const existingAttributes = await tx
          .select()
          .from(attributes)
          .where(
            inArray(attributes.id, requestedIds),
          )
          .for('share');

        const attributeMap = new Map(
          existingAttributes.map(
            (attribute) => [
              attribute.id,
              attribute,
            ],
          ),
        );

        for (const requested of input.attributes) {
          const found = attributeMap.get(
            requested.attributeId,
          );

          if (!found || found.scope !== 'global') {
            throw new BadRequestException({
              success: false,
              message: 'Attribut invalide.',
              errors: {
                attributes: [
                  'Un attribut global existant est obligatoire.',
                ],
              },
            });
          }
        }

        // 2. Validate values belong to attributes.
        const requestedValueIds = [
          ...new Set(
            input.attributes.flatMap(
              (attribute) => attribute.valueIds,
            ),
          ),
        ];

        const values = await tx
          .select()
          .from(attributeValues)
          .where(
            inArray(
              attributeValues.id,
              requestedValueIds,
            ),
          )
          .for('share');

        const valueMap = new Map(
          values.map((value) => [
            value.id,
            value,
          ]),
        );

        for (const attribute of input.attributes) {
          for (const valueId of attribute.valueIds) {
            const value = valueMap.get(valueId);

            if (
              !value ||
              value.attributeId !==
                attribute.attributeId
            ) {
              throw new BadRequestException({
                success: false,
                message: "Valeur d'attribut invalide.",
                errors: {
                  attributes: [
                    'La valeur ne correspond pas à son attribut.',
                  ],
                },
              });
            }
          }
        }

        // 3. Generate canonical combinations.
        const combinationKeys = input.variants.map(
          (variant) =>
            buildCombinationKey(variant.options),
        );

        if (
          new Set(combinationKeys).size !==
          combinationKeys.length
        ) {
          throw new ConflictException({
            success: false,
            message: 'Combinaisons dupliquées.',
            errors: {
              variants: [
                'Deux variations ont les mêmes options.',
              ],
            },
          });
        }

        // 4. Create product.
        const [product] = await tx
          .insert(products)
          .values({
            name: input.name,
            slug: input.slug,
            type: 'variable',
            status: input.status,
            shortDescription:
              input.shortDescription ?? null,
            description:
              input.description ?? null,
            seoTitle: input.seoTitle ?? null,
            seoDescription:
              input.seoDescription ?? null,
            isFeatured: input.isFeatured,
            createdBy: adminId,
            updatedBy: adminId,
          })
          .returning();

        // 5. Assign product attributes.
        await tx.insert(productAttributes).values(
          input.attributes.map((attribute, i) => ({
            productId: product.id,
            attributeId: attribute.attributeId,
            visible: attribute.visible,
            usedForVariations: true,
            position: i,
          })),
        );

        // 6. Assign allowed values.
        await tx
          .insert(productAttributeValues)
          .values(
            input.attributes.flatMap((attribute) =>
              attribute.valueIds.map((valueId) => ({
                productId: product.id,
                attributeId: attribute.attributeId,
                valueId,
              })),
            ),
          );

        // 7. Create variants and options.
        const createdVariants: Array<{
          id: string;
          sku: string | null;
          combinationKey: string | null;
          isDefault: boolean;
        }> = [];

        for (
          const [index, variant] of
          input.variants.entries()
        ) {
          const [created] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              sku: variant.sku,
              ean: variant.ean,
              regularPrice:
                variant.regularPrice,
              salePrice:
                variant.salePrice ?? null,
              stockQuantity:
                variant.stockQuantity,
              manageStock:
                variant.manageStock,
              isActive: variant.isActive,
              isDefault: variant.isDefault,
              position: index,
              combinationKey:
                combinationKeys[index],
            })
            .returning();

          await tx
            .insert(variantAttributeValues)
            .values(
              variant.options.map((option) => ({
                variantId: created.id,
                attributeId: option.attributeId,
                valueId: option.valueId,
              })),
            );

          createdVariants.push({
            id: created.id,
            sku: created.sku,
            combinationKey:
              created.combinationKey,
            isDefault: created.isDefault,
          });
        }

        // 8. Audit within same transaction.
        await tx.insert(productActivity).values({
          productId: product.id,
          actorId: adminId,
          action: 'product.created',
          changes: {
            type: 'variable',
            status: product.status,
            attributesCount:
              input.attributes.length,
            variantsCount:
              createdVariants.length,
          },
        });

        return {
          ...product,
          variants: createdVariants,
        };
      });
    } catch (error) {
      throwProductDbError(error);
    }
  }

  // ======================================
  // LIST PRODUCTS
  // ======================================

  // async findAll(input: ProductListInput) {
  //   const filters: SQL[] = [];

  //   if (input.status) {
  //     filters.push(
  //       eq(products.status, input.status),
  //     );
  //   }

  //   if (input.type) {
  //     filters.push(
  //       eq(products.type, input.type),
  //     );
  //   }

  //   if (input.search) {
  //     const escaped = input.search.replace(
  //       /[%_\\]/g,
  //       '\\$&',
  //     );

  //     const condition = or(
  //       ilike(
  //         products.name,
  //         `%${escaped}%`,
  //       ),
  //       ilike(
  //         products.slug,
  //         `%${escaped}%`,
  //       ),
  //     );

  //     if (condition) filters.push(condition);
  //   }

  //   const where = filters.length
  //     ? and(...filters)
  //     : undefined;

  //   const [items, totals] = await Promise.all([
  //     this.db
  //       .select({
  //         id: products.id,
  //         name: products.name,
  //         slug: products.slug,
  //         type: products.type,
  //         status: products.status,
  //         isFeatured: products.isFeatured,
  //         createdBy: products.createdBy,
  //         updatedBy: products.updatedBy,
  //         createdAt: products.createdAt,
  //         updatedAt: products.updatedAt,
  //         sku: productVariants.sku,
  //         regularPrice:
  //           productVariants.regularPrice,
  //         stockQuantity:
  //           productVariants.stockQuantity,
  //       })
  //       .from(products)
  //       .leftJoin(
  //         productVariants,
  //         and(
  //           eq(
  //             productVariants.productId,
  //             products.id,
  //           ),
  //           eq(productVariants.isDefault, true),
  //         ),
  //       )
  //       .where(where)
  //       .orderBy(
  //         desc(products.createdAt),
  //         desc(products.id),
  //       )
  //       .limit(input.limit)
  //       .offset(
  //         (input.page - 1) * input.limit,
  //       ),

  //     this.db
  //       .select({ total: count() })
  //       .from(products)
  //       .where(where),
  //   ]);

  //   const total = totals[0]?.total ?? 0;

  //   return {
  //     items,
  //     pagination: {
  //       page: input.page,
  //       limit: input.limit,
  //       total,
  //       totalPages: Math.ceil(
  //         total / input.limit,
  //       ),
  //     },
  //   };
  // }

  async findAll(input: ProductListInput) {
    const filters: SQL[] = [];

    if (input.status) {
      filters.push(
        sql`p.status = ${input.status}::product_status`,
      );
    }

    if (input.type) {
      filters.push(
        sql`p.type = ${input.type}::product_type`,
      );
    }

    if (input.trash === 'active') {
      filters.push(sql`
        NOT EXISTS (
          SELECT 1
          FROM product_deletion_state ds
          WHERE ds.product_id = p.id
        )
      `);
    } else if (input.trash === 'trash') {
      filters.push(sql`
        EXISTS (
          SELECT 1
          FROM product_deletion_state ds
          WHERE ds.product_id = p.id
        )
      `);
    }

    if (input.categoryId) {
      filters.push(sql`
        EXISTS (
          SELECT 1
          FROM product_categories pc
          WHERE pc.product_id = p.id
            AND pc.category_id = ${input.categoryId}::uuid
        )
      `);
    }

    if (input.brandId) {
      filters.push(sql`
        EXISTS (
          SELECT 1
          FROM product_brands pb
          WHERE pb.product_id = p.id
            AND pb.brand_id = ${input.brandId}::uuid
        )
      `);
    }

    if (input.search) {
      const term = input.search.toLowerCase();

      filters.push(sql`
        (
          strpos(lower(p.name), ${term}) > 0
          OR strpos(lower(p.slug), ${term}) > 0
          OR EXISTS (
            SELECT 1
            FROM product_variants sv
            WHERE sv.product_id = p.id
              AND (
                strpos(lower(sv.sku), ${term}) > 0
                OR strpos(lower(sv.ean), ${term}) > 0
              )
          )
        )
      `);
    }

    const where = filters.length
      ? sql`WHERE ${sql.join(filters, sql` AND `)}`
      : sql``;

    const sortColumn =
      input.sortBy === 'name'
        ? sql`p.name`
        : input.sortBy === 'updatedAt'
          ? sql`p.updated_at`
          : sql`p.created_at`;

    const sortDirection =
      input.sortOrder === 'asc'
        ? sql`ASC`
        : sql`DESC`;

    const offset = (input.page - 1) * input.limit;

    type ListRow = {
      id: string;
      name: string;
      slug: string;
      type: 'simple' | 'variable';
      status: 'draft' | 'published' | 'private' | 'archived';
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
    };

    const [results, totals] = await Promise.all([
      this.db.execute(sql`
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

          m.source_type::text AS "imageSourceType",
          m.storage_provider::text AS "imageStorageProvider",
          m.storage_key AS "imageStorageKey",
          m.external_url AS "imageExternalUrl",
          m.original_name AS "imageOriginalName",
          m.alt_text AS "imageAltText",

          EXISTS (
            SELECT 1
            FROM product_deletion_state ds
            WHERE ds.product_id = p.id
          ) AS "isDeleted"

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

        ${where}

        ORDER BY
          ${sortColumn} ${sortDirection},
          p.id ${sortDirection}

        LIMIT ${input.limit}
        OFFSET ${offset}
      `),

      this.db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM products p
        ${where}
      `),
    ]);

    const items = (
      results.rows as unknown as ListRow[]
    ).map((row) => {
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
              storageProvider: imageStorageProvider,
              storageKey: imageStorageKey,
              externalUrl: imageExternalUrl,
              originalName: imageOriginalName,
              altText: imageAltText,
            }
          : null,
      };
    });

    const total = Number(
      (
        totals.rows[0] as
          | { total?: number | string }
          | undefined
      )?.total ?? 0,
    );

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  // ======================================
  // GET PRODUCT DETAILS
  // ======================================

  async findOne(id: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    const variants = await this.db
      .select()
      .from(productVariants)
      .where(
        eq(productVariants.productId, id),
      )
      .orderBy(
        asc(productVariants.position),
        asc(productVariants.id),
      );

    if (product.type === 'simple') {
      return {
        ...product,
        variants: variants.map((variant) => ({
          ...variant,
          options: [],
        })),
        attributes: [],
      };
    }

    const assignedAttributes = await this.db
      .select({
        attributeId:
          productAttributes.attributeId,
        visible: productAttributes.visible,
        usedForVariations:
          productAttributes.usedForVariations,
        position: productAttributes.position,
        name: attributes.name,
        code: attributes.code,
      })
      .from(productAttributes)
      .innerJoin(
        attributes,
        eq(
          productAttributes.attributeId,
          attributes.id,
        ),
      )
      .where(
        eq(productAttributes.productId, id),
      )
      .orderBy(asc(productAttributes.position));

    const allowedValues = await this.db
      .select({
        attributeId:
          productAttributeValues.attributeId,
        valueId:
          productAttributeValues.valueId,
        name: attributeValues.name,
        slug: attributeValues.slug,
      })
      .from(productAttributeValues)
      .innerJoin(
        attributeValues,
        eq(
          productAttributeValues.valueId,
          attributeValues.id,
        ),
      )
      .where(
        eq(productAttributeValues.productId, id),
      );

    const variantIds = variants.map(
      (variant) => variant.id,
    );

    const selectedOptions = variantIds.length
      ? await this.db
          .select({
            variantId:
              variantAttributeValues.variantId,
            attributeId:
              variantAttributeValues.attributeId,
            valueId:
              variantAttributeValues.valueId,
            valueName: attributeValues.name,
          })
          .from(variantAttributeValues)
          .innerJoin(
            attributeValues,
            eq(
              variantAttributeValues.valueId,
              attributeValues.id,
            ),
          )
          .where(
            inArray(
              variantAttributeValues.variantId,
              variantIds,
            ),
          )
      : [];

    return {
      ...product,
      attributes: assignedAttributes.map(
        (attribute) => ({
          ...attribute,
          values: allowedValues.filter(
            (value) =>
              value.attributeId ===
              attribute.attributeId,
          ),
        }),
      ),
      variants: variants.map((variant) => ({
        ...variant,
        options: selectedOptions.filter(
          (option) =>
            option.variantId === variant.id,
        ),
      })),
    };
  }

  // ======================================
  // UPDATE SIMPLE PRODUCT
  // ======================================

  async update(
    id: string,
    input: UpdateProductInput,
    adminId: string,
  ) {
    try {
      await this.db.transaction(async (tx) => {
        const [oldProduct] = await tx
          .select()
          .from(products)
          .where(eq(products.id, id))
          .for('update')
          .limit(1);

        if (!oldProduct) {
          throw new NotFoundException({
            success: false,
            message: 'Produit introuvable.',
          });
        }

        if (oldProduct.type !== 'simple') {
          throw new BadRequestException({
            success: false,
            message:
              'La modification des produits variables nécessite une opération dédiée.',
          });
        }

        const [oldVariant] = await tx
          .select()
          .from(productVariants)
          .where(
            and(
              eq(
                productVariants.productId,
                id,
              ),
              eq(
                productVariants.isDefault,
                true,
              ),
            ),
          )
          .for('update')
          .limit(1);

        if (!oldVariant) {
          throw new ConflictException({
            success: false,
            message:
              'Variation principale introuvable.',
          });
        }

        const patch = input.variant ?? {};

        const nextStatus =
          input.status ?? oldProduct.status;

        const nextPrice =
          patch.regularPrice === undefined
            ? oldVariant.regularPrice
            : patch.regularPrice;

        const nextSale =
          patch.salePrice === undefined
            ? oldVariant.salePrice
            : patch.salePrice;

        const nextActive =
          patch.isActive ??
          oldVariant.isActive;

        if (
          nextStatus === 'published' &&
          (nextPrice === null || !nextActive)
        ) {
          throw new BadRequestException({
            success: false,
            message:
              'Le produit ne peut pas être publié.',
            errors: {
              variant: [
                'Une variation active avec prix est obligatoire.',
              ],
            },
          });
        }

        if (
          nextSale !== null &&
          (
            nextPrice === null ||
            toCents(nextSale) > toCents(nextPrice)
          )
        ) {
          throw new BadRequestException({
            success: false,
            message: 'Prix promotionnel invalide.',
            errors: {
              'variant.salePrice': [
                'Le prix promotionnel dépasse le prix normal.',
              ],
            },
          });
        }

        const productPatch = {
          ...(input.name !== undefined
            ? { name: input.name }
            : {}),

          ...(input.slug !== undefined
            ? { slug: input.slug }
            : {}),

          ...(input.status !== undefined
            ? { status: input.status }
            : {}),

          ...(input.shortDescription !== undefined
            ? {
                shortDescription:
                  input.shortDescription,
              }
            : {}),

          ...(input.description !== undefined
            ? { description: input.description }
            : {}),

          ...(input.seoTitle !== undefined
            ? { seoTitle: input.seoTitle }
            : {}),

          ...(input.seoDescription !== undefined
            ? {
                seoDescription:
                  input.seoDescription,
              }
            : {}),

          ...(input.isFeatured !== undefined
            ? { isFeatured: input.isFeatured }
            : {}),
        };

        const changes = {
          ...changesBetween(
            oldProduct,
            productPatch,
          ),
          ...Object.fromEntries(
            Object.entries(
              changesBetween(
                oldVariant,
                patch,
              ),
            ).map(([field, value]) => [
              `variant.${field}`,
              value,
            ]),
          ),
        };

        await tx
          .update(products)
          .set({
            ...productPatch,
            updatedBy: adminId,
            updatedAt: new Date(),
          })
          .where(eq(products.id, id));

        if (Object.keys(patch).length) {
          await tx
            .update(productVariants)
            .set({
              ...patch,
              updatedAt: new Date(),
            })
            .where(
              eq(
                productVariants.id,
                oldVariant.id,
              ),
            );
        }

        await tx.insert(productActivity).values({
          productId: id,
          actorId: adminId,
          action: 'product.updated',
          changes,
        });
      });
    } catch (error) {
      throwProductDbError(error);
    }

    return this.findOne(id);
  }

  // ======================================
  // AUDIT HISTORY
  // ======================================

  async activity(id: string) {
    const [exists] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!exists) {
      throw new NotFoundException({
        success: false,
        message: 'Produit introuvable.',
      });
    }

    return this.db
      .select()
      .from(productActivity)
      .where(
        eq(productActivity.productId, id),
      )
      .orderBy(
        desc(productActivity.createdAt),
        desc(productActivity.id),
      )
      .limit(100);
  }
}
