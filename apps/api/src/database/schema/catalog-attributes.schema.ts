
import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';

import { products, productVariants } from './catalog.schema';
import { adminUsers } from './auth.schema';

// =====================================
// ENUMS
// =====================================

export const attributeScopeEnum = pgEnum(
  'attribute_scope',
  ['global', 'custom'],
);

// =====================================
// ATTRIBUTES
// =====================================

export const attributes = pgTable(
  'attributes',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),

    code: varchar('code', { length: 100 }).notNull(),

    scope: attributeScopeEnum('scope')
      .notNull()
      .default('global'),

    // Required only for custom attributes
    productId: uuid('product_id').references(
      () => products.id,
      { onDelete: 'cascade' },
    ),

    description: text('description'),

    position: integer('position').notNull().default(0),

    isFilterable: boolean('is_filterable')
      .notNull()
      .default(true),

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
    uniqueIndex('attributes_global_code_unique')
      .on(table.code)
      .where(sql`${table.scope} = 'global'`),

    uniqueIndex('attributes_custom_code_unique')
      .on(table.productId, table.code)
      .where(sql`${table.scope} = 'custom'`),

    index('attributes_product_idx')
      .on(table.productId),

    check(
      'attributes_scope_product_valid',
      sql`(
        ${table.scope} = 'global'
        AND ${table.productId} IS NULL
      ) OR (
        ${table.scope} = 'custom'
        AND ${table.productId} IS NOT NULL
      )`,
    ),

    check(
      'attributes_position_nonnegative',
      sql`${table.position} >= 0`,
    ),

    check(
      'attributes_code_not_blank',
      sql`length(btrim(${table.code})) > 0`,
    ),
  ],
);

// =====================================
// ATTRIBUTE VALUES
// =====================================

export const attributeValues = pgTable(
  'attribute_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, {
        onDelete: 'restrict',
      }),

    name: varchar('name', { length: 150 }).notNull(),

    slug: varchar('slug', { length: 150 }).notNull(),

    // Optional hexadecimal color for swatches
    colorHex: varchar('color_hex', { length: 7 }),

    position: integer('position').notNull().default(0),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('attribute_values_slug_unique')
      .on(table.attributeId, table.slug),

    index('attribute_values_attribute_idx')
      .on(table.attributeId),

    check(
      'attribute_values_position_nonnegative',
      sql`${table.position} >= 0`,
    ),

    check(
      'attribute_values_color_hex_valid',
      sql`${table.colorHex} IS NULL OR
        ${table.colorHex} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

// =====================================
// PRODUCT ATTRIBUTES
// =====================================

export const productAttributes = pgTable(
  'product_attributes',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, {
        onDelete: 'restrict',
      }),

    visible: boolean('visible')
      .notNull()
      .default(true),

    usedForVariations: boolean('used_for_variations')
      .notNull()
      .default(false),

    position: integer('position')
      .notNull()
      .default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.attributeId],
    }),

    index('product_attributes_attribute_idx')
      .on(table.attributeId),

    check(
      'product_attributes_position_nonnegative',
      sql`${table.position} >= 0`,
    ),
  ],
);

// =====================================
// ALLOWED ATTRIBUTE VALUES PER PRODUCT
// =====================================

export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, {
        onDelete: 'restrict',
      }),

    valueId: uuid('value_id')
      .notNull()
      .references(() => attributeValues.id, {
        onDelete: 'restrict',
      }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.productId,
        table.attributeId,
        table.valueId,
      ],
    }),

    index('product_attribute_values_value_idx')
      .on(table.valueId),
  ],
);

// =====================================
// VARIANT ATTRIBUTE VALUES
// =====================================

export const variantAttributeValues = pgTable(
  'variant_attribute_values',
  {
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, {
        onDelete: 'cascade',
      }),

    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, {
        onDelete: 'restrict',
      }),

    valueId: uuid('value_id')
      .notNull()
      .references(() => attributeValues.id, {
        onDelete: 'restrict',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.variantId, table.attributeId],
    }),

    index('variant_attribute_values_value_idx')
      .on(table.valueId),

    index('variant_attribute_values_attr_value_idx')
      .on(table.attributeId, table.valueId),
  ],
);

// =====================================
// TYPES
// =====================================

export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;

export type AttributeValue =
  typeof attributeValues.$inferSelect;

export type NewAttributeValue =
  typeof attributeValues.$inferInsert;

export type ProductAttribute =
  typeof productAttributes.$inferSelect;

export type VariantAttributeValue =
  typeof variantAttributeValues.$inferSelect;
