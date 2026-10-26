
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// Customer accounts
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),

  email: varchar('email', { length: 255 })
    .notNull()
    .unique(),

  passwordHash: text('password_hash'),

  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 30 }),

  isActive: boolean('is_active')
    .notNull()
    .default(true),

  emailVerifiedAt: timestamp('email_verified_at', {
    withTimezone: true,
  }),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  }).notNull().defaultNow(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  }).notNull().defaultNow(),
});

// Customer sessions
export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, {
        onDelete: 'cascade',
      }),

    tokenHash: text('token_hash')
      .notNull()
      .unique(),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
    }).notNull(),

    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('customer_sessions_customer_idx')
      .on(table.customerId),

    index('customer_sessions_expires_idx')
      .on(table.expiresAt),
  ],
);

// Customer addresses
export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, {
        onDelete: 'cascade',
      }),

    label: varchar('label', { length: 100 }),

    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),

    phone: varchar('phone', { length: 30 }),

    addressLine1: varchar('address_line_1', {
      length: 255,
    }).notNull(),

    addressLine2: varchar('address_line_2', {
      length: 255,
    }),

    city: varchar('city', { length: 120 }).notNull(),
    region: varchar('region', { length: 120 }),
    postalCode: varchar('postal_code', { length: 20 }),

    countryCode: varchar('country_code', {
      length: 2,
    }).notNull(),

    isDefaultShipping: boolean('is_default_shipping')
      .notNull().default(false),

    isDefaultBilling: boolean('is_default_billing')
      .notNull().default(false),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index('customer_addresses_customer_idx')
      .on(table.customerId),
  ],
);
