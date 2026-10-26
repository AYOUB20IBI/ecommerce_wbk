
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { adminUsers } from './auth.schema';
import { customers } from './customer.schema';

// Password reset for administrators
export const adminPasswordResetTokens = pgTable(
  'admin_password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull(),

    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('admin_reset_token_hash_idx').on(table.tokenHash),
    index('admin_reset_user_idx').on(table.adminUserId),
  ],
);

// Password reset for customers
export const customerPasswordResetTokens = pgTable(
  'customer_password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull(),

    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('customer_reset_token_hash_idx').on(table.tokenHash),
    index('customer_reset_user_idx').on(table.customerId),
  ],
);

// Customer email verification
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull(),

    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('email_verification_token_hash_idx').on(table.tokenHash),
    index('email_verification_customer_idx').on(table.customerId),
  ],
);
