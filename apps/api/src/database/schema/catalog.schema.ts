
import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';

import { adminUsers } from './auth.schema';

// ======================================
// ENUMS
// ======================================

export const productTypeEnum = pgEnum('product_type', [
  'simple',
  'variable',
]);

export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'published',
  'private',
  'archived',
]);

// ======================================
// PRODUCTS
// ======================================

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 255 })
      .notNull(),

    slug: varchar('slug', { length: 255 })
      .notNull(),

    type: productTypeEnum('type')
      .notNull()
      .default('simple'),

    status: productStatusEnum('status')
      .notNull()
      .default('draft'),

    shortDescription: text('short_description'),

    description: text('description'),

    seoTitle: varchar('seo_title', { length: 255 }),

    seoDescription: text('seo_description'),

    isFeatured: boolean('is_featured')
      .notNull()
      .default(false),

    // Admin responsible for creation
    createdBy: uuid('created_by')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    // Last admin who updated this product
    updatedBy: uuid('updated_by')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('products_slug_unique')
      .on(table.slug),

    index('products_status_idx')
      .on(table.status),

    index('products_type_idx')
      .on(table.type),

    index('products_created_by_idx')
      .on(table.createdBy),

    index('products_updated_by_idx')
      .on(table.updatedBy),

    index('products_created_at_idx')
      .on(table.createdAt),
  ],
);

// ======================================
// PRODUCT VARIANTS
// ======================================

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),
      
    combinationKey: varchar('combination_key', {
      length: 64,
    }),

    // Optional but unique if provided
    sku: varchar('sku', { length: 100 }),

    // Optional barcode
    ean: varchar('ean', { length: 32 }),

    // Nullable for incomplete draft products
    regularPrice: numeric('regular_price', {
      precision: 12,
      scale: 2,
    }),

    salePrice: numeric('sale_price', {
      precision: 12,
      scale: 2,
    }),

    stockQuantity: integer('stock_quantity')
      .notNull()
      .default(0),

    manageStock: boolean('manage_stock')
      .notNull()
      .default(true),

    isActive: boolean('is_active')
      .notNull()
      .default(true),

    isDefault: boolean('is_default')
      .notNull()
      .default(false),

    position: integer('position')
      .notNull()
      .default(0),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    
    uniqueIndex('product_variants_combination_unique')
      .on(table.productId, table.combinationKey)
      .where(sql`${table.combinationKey} IS NOT NULL`),

    uniqueIndex('product_variants_sku_unique')
      .on(table.sku),

    uniqueIndex('product_variants_ean_unique')
      .on(table.ean),

    uniqueIndex('product_variants_one_default')
      .on(table.productId)
      .where(sql`${table.isDefault} = true`),

    index('product_variants_product_idx')
      .on(table.productId),

    check(
      'variant_regular_price_nonnegative',
      sql`${table.regularPrice} IS NULL
        OR ${table.regularPrice} >= 0`,
    ),

    check(
      'variant_sale_price_valid',
      sql`${table.salePrice} IS NULL
        OR (
          ${table.regularPrice} IS NOT NULL
          AND ${table.salePrice} >= 0
          AND ${table.salePrice} <= ${table.regularPrice}
        )`,
    ),

    check(
      'variant_stock_nonnegative',
      sql`${table.stockQuantity} >= 0`,
    ),

    check(
      'variant_position_nonnegative',
      sql`${table.position} >= 0`,
    ),
  ],
);

// ======================================
// TYPES
// ======================================

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductVariant =
  typeof productVariants.$inferSelect;

export type NewProductVariant =
  typeof productVariants.$inferInsert;
