
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const productPurgeAudit = pgTable(
  'product_purge_audit',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom(),

    productId: uuid('product_id')
      .notNull(),

    productName: text('product_name')
      .notNull(),

    productSlug: text('product_slug')
      .notNull(),

    productType: varchar('product_type', {
      length: 30,
    }).notNull(),

    purgedBy: uuid('purged_by')
      .notNull(),

    purgedAt: timestamp('purged_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index('product_purge_audit_product_id_idx')
      .on(table.productId),

    index('product_purge_audit_purged_at_idx')
      .on(table.purgedAt),
  ],
);
