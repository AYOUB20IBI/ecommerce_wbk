
import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';

import { media, storageProviderEnum } from './catalog-media.schema';

export const deletionJobStatusEnum = pgEnum(
  'media_deletion_job_status',
  ['pending', 'processing', 'completed', 'failed'],
);

export const mediaDeletionJobs = pgTable(
  'media_deletion_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, {
        onDelete: 'restrict',
      }),

    provider: storageProviderEnum('provider')
      .notNull(),

    storageKey: varchar('storage_key', {
      length: 500,
    }).notNull(),

    status: deletionJobStatusEnum('status')
      .notNull()
      .default('pending'),

    attempts: integer('attempts')
      .notNull()
      .default(0),

    maxAttempts: integer('max_attempts')
      .notNull()
      .default(8),

    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    lockedUntil: timestamp('locked_until', {
      withTimezone: true,
    }),

    lockToken: uuid('lock_token'),

    lastError: text('last_error'),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    completedAt: timestamp('completed_at', {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex('media_deletion_jobs_media_unique')
      .on(table.mediaId),

    index('media_deletion_jobs_pending_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} = 'pending'`),

    index('media_deletion_jobs_lease_idx')
      .on(table.lockedUntil)
      .where(sql`${table.status} = 'processing'`),

    check(
      'media_deletion_jobs_attempts_valid',
      sql`${table.attempts} >= 0
        AND ${table.maxAttempts} > 0`,
    ),

    check(
      'media_deletion_jobs_processing_lease',
      sql`${table.status} <> 'processing'
        OR (
          ${table.lockToken} IS NOT NULL
          AND ${table.lockedUntil} IS NOT NULL
        )`,
    ),
  ],
);

export type MediaDeletionJob =
  typeof mediaDeletionJobs.$inferSelect;
