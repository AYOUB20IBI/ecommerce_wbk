
import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

import { products } from './catalog.schema';
import { adminUsers } from './auth.schema';

export const productActivity = pgTable(
  'product_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, {
        onDelete: 'restrict',
      }),

    actorId: uuid('actor_id')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    action: varchar('action', {
      length: 100,
    }).notNull(),

    changes: jsonb('changes')
      .$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('product_activity_product_created_idx')
      .on(table.productId, table.createdAt),

    index('product_activity_actor_idx')
      .on(table.actorId),
  ],
);
