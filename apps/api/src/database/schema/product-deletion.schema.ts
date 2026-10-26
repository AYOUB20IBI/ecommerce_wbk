
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';

import { products } from './catalog.schema';
import { adminUsers } from './auth.schema';

export const productDeletionState = pgTable(
  'product_deletion_state',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id, {
        onDelete: 'restrict',
      }),

    previousStatus: varchar('previous_status', {
      length: 20,
    }).notNull(),

    deletedBy: uuid('deleted_by')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('product_deletion_state_deleted_at_idx')
      .on(table.deletedAt),

    check(
      'product_deletion_state_previous_status_check',
      sql`${table.previousStatus} IN (
        'draft',
        'published',
        'private',
        'archived'
      )`,
    ),
  ],
);
