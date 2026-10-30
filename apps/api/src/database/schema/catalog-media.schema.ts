
import { sql } from 'drizzle-orm';

import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

import {
  products,
  productVariants,
} from './catalog.schema';

import { adminUsers } from './auth.schema';

// =====================================
// ENUMS
// =====================================

export const mediaSourceEnum = pgEnum(
  'media_source',
  ['upload', 'external'],
);

export const storageProviderEnum = pgEnum(
  'media_storage_provider',
  ['local', 's3'],
);

export const mediaStatusEnum = pgEnum(
  'media_status',
  ['ready', 'deleting', 'deleted'],
);

// =====================================
// MEDIA LIBRARY
// =====================================

export const media = pgTable(
  'media',
  {
    id: uuid('id')
      .defaultRandom()
      .primaryKey(),

    sourceType: mediaSourceEnum('source_type')
      .notNull(),

    storageProvider: storageProviderEnum(
      'storage_provider',
    ),

    storageKey: varchar('storage_key', {
      length: 500,
    }),

    externalUrl: text('external_url'),

    originalName: varchar('original_name', {
      length: 255,
    }).notNull(),

    mimeType: varchar('mime_type', {
      length: 100,
    }),

    fileSize: bigint('file_size', {
      mode: 'number',
    }),

    width: integer('width'),
    height: integer('height'),

    altText: varchar('alt_text', {
      length: 255,
    }),

    status: mediaStatusEnum('status')
      .notNull()
      .default('ready'),

    uploadedBy: uuid('uploaded_by')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    updatedBy: uuid('updated_by')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('media_provider_key_unique')
      .on(
        table.storageProvider,
        table.storageKey,
      ),

    index('media_status_created_idx')
      .on(
        table.status,
        table.createdAt,
      ),

    index('media_uploaded_by_idx')
      .on(table.uploadedBy),

    // Uploads must contain valid storage metadata.
    // Images have dimensions; other file types do not
    // require width or height.
    //
    // MIME allowlist and file signature validation
    // are enforced by MediaService, not this check.
    check(
      'media_source_consistency',
      sql`(
        (
          ${table.sourceType} = 'upload'
          AND ${table.storageProvider} IS NOT NULL
          AND ${table.storageKey} IS NOT NULL
          AND length(${table.storageKey}) > 0
          AND ${table.externalUrl} IS NULL
          AND ${table.mimeType} IS NOT NULL
          AND length(${table.mimeType}) > 0
          AND ${table.fileSize} IS NOT NULL
          AND ${table.fileSize} > 0
          AND (
            (
              ${table.width} IS NULL
              AND ${table.height} IS NULL
            )
            OR
            (
              ${table.width} > 0
              AND ${table.height} > 0
            )
          )
        )
        OR
        (
          ${table.sourceType} = 'external'
          AND ${table.storageProvider} IS NULL
          AND ${table.storageKey} IS NULL
          AND ${table.externalUrl} IS NOT NULL
          AND length(${table.externalUrl}) > 0
          AND ${table.mimeType} IS NULL
          AND ${table.fileSize} IS NULL
          AND ${table.width} IS NULL
          AND ${table.height} IS NULL
        )
      )`,
    ),

    // URL protocol is validated again in MediaService.
    // Localhost/private network restrictions belong
    // to the application's external URL validator.
    check(
      'media_external_https',
      sql`(
        ${table.externalUrl} IS NULL
        OR ${table.externalUrl} LIKE 'https://%'
        OR ${table.externalUrl} LIKE 'http://%'
      )`,
    ),
  ],
);

// =====================================
// PRODUCT IMAGES
// =====================================

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id')
      .defaultRandom()
      .primaryKey(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'cascade',
      }),

    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, {
        onDelete: 'restrict',
      }),

    variantId: uuid('variant_id')
      .references(() => productVariants.id, {
        onDelete: 'cascade',
      }),

    isFeatured: boolean('is_featured')
      .notNull()
      .default(false),

    position: integer('position')
      .notNull()
      .default(0),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('product_images_product_idx')
      .on(table.productId),

    index('product_images_media_idx')
      .on(table.mediaId),

    index('product_images_variant_idx')
      .on(table.variantId),

    uniqueIndex('product_images_one_featured')
      .on(table.productId)
      .where(sql`${table.isFeatured} = true`),

    check(
      'product_images_position_nonnegative',
      sql`${table.position} >= 0`,
    ),

    check(
      'product_images_featured_not_variant',
      sql`${table.isFeatured} = false
          OR ${table.variantId} IS NULL`,
    ),
  ],
);

// =====================================
// MEDIA ACTIVITY
// =====================================

export const mediaActivity = pgTable(
  'media_activity',
  {
    id: uuid('id')
      .defaultRandom()
      .primaryKey(),

    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, {
        onDelete: 'restrict',
      }),

    actorId: uuid('actor_id')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    action: varchar('action', {
      length: 100,
    }).notNull(),

    changes: text('changes'),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('media_activity_media_created_idx')
      .on(
        table.mediaId,
        table.createdAt,
      ),
  ],
);

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type ProductImage =
  typeof productImages.$inferSelect;
