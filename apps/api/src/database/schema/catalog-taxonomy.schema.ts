
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { products } from './catalog.schema';
import { adminUsers } from './auth.schema';

// ======================================
// CATEGORIES (Parent / Child)
// ======================================

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 255 }).notNull(),

    slug: varchar('slug', { length: 255 }).notNull(),

    parentId: uuid('parent_id').references(
      (): AnyPgColumn => categories.id,
      { onDelete: 'restrict' },
    ),

    description: text('description'),

    imageUrl: text('image_url'),

    seoTitle: varchar('seo_title', { length: 255 }),

    seoDescription: text('seo_description'),

    position: integer('position').notNull().default(0),

    isActive: boolean('is_active').notNull().default(true),

    createdBy: uuid('created_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    updatedBy: uuid('updated_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('categories_slug_unique').on(table.slug),
    index('categories_parent_idx').on(table.parentId),

    check(
      'categories_no_self_parent',
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),

    check(
      'categories_position_nonnegative',
      sql`${table.position} >= 0`,
    ),
  ],
);

// ======================================
// PRODUCT <-> CATEGORIES
// ======================================

export const productCategories = pgTable(
  'product_categories',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, {
        onDelete: 'restrict',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.categoryId],
    }),

    index('product_categories_category_idx')
      .on(table.categoryId),
  ],
);

// ======================================
// TAGS
// ======================================

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 255 }).notNull(),

    slug: varchar('slug', { length: 255 }).notNull(),

    description: text('description'),

    createdBy: uuid('created_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    updatedBy: uuid('updated_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tags_slug_unique').on(table.slug),
  ],
);

// ======================================
// PRODUCT <-> TAGS
// ======================================

export const productTags = pgTable(
  'product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, {
        onDelete: 'restrict',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.tagId],
    }),

    index('product_tags_tag_idx').on(table.tagId),
  ],
);

// ======================================
// BRANDS
// ======================================

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 255 }).notNull(),

    slug: varchar('slug', { length: 255 }).notNull(),

    description: text('description'),

    logoUrl: text('logo_url'),

    seoTitle: varchar('seo_title', { length: 255 }),

    seoDescription: text('seo_description'),

    createdBy: uuid('created_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    updatedBy: uuid('updated_by').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('brands_slug_unique').on(table.slug),
  ],
);

// ======================================
// PRODUCT -> BRAND (OPTIONAL, MAX ONE)
// ======================================

export const productBrands = pgTable(
  'product_brands',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, {
        onDelete: 'restrict',
      }),
  },
  (table) => [
    index('product_brands_brand_idx').on(table.brandId),
  ],
);

// ======================================
// TYPES
// ======================================

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
