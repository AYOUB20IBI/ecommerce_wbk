
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  primaryKey,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

import {
  adminUsers,
  roles,
} from './auth.schema';

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),

  code: varchar('code', { length: 120 })
    .notNull()
    .unique(),

  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, {
        onDelete: 'cascade',
      }),

    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
    }),
    index('role_permissions_permission_idx')
      .on(table.permissionId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    adminUserId: uuid('admin_user_id')
      .references(() => adminUsers.id, {
        onDelete: 'set null',
      }),

    action: varchar('action', { length: 120 })
      .notNull(),

    entityType: varchar('entity_type', { length: 80 }),
    entityId: uuid('entity_id'),

    metadata: jsonb('metadata'),

    ipAddress: varchar('ip_address', { length: 45 }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_admin_idx')
      .on(table.adminUserId),

    index('audit_logs_created_idx')
      .on(table.createdAt),
  ],
);
