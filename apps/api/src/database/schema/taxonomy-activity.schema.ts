
import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const taxonomyActivity = pgTable(
  'taxonomy_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    entityType: varchar('entity_type', {
      length: 20,
    }).notNull(),

    entityId: uuid('entity_id').notNull(),

    adminId: uuid('admin_id').notNull(),

    action: varchar('action', {
      length: 80,
    }).notNull(),

    changes: jsonb('changes')
      .$type<Record<string, unknown>>()
      .notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index('taxonomy_activity_entity_idx')
      .on(table.entityType, table.entityId),

    index('taxonomy_activity_admin_idx')
      .on(table.adminId),
  ],
);
