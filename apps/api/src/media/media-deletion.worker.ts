
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';
import {
  media,
  mediaActivity,
} from '../database/schema/catalog-media.schema';
import {
  mediaDeletionJobs,
} from '../database/schema/media-deletion-job.schema';
import { StorageManagerService } from './storage/storage-manager.service';

const POLL_INTERVAL_MS = 10_000;
const LEASE_MS = 5 * 60_000;
const MAX_BACKOFF_SECONDS = 60 * 60;

@Injectable()
export class MediaDeletionWorker
  implements OnModuleInit, OnModuleDestroy {

  private readonly logger =
    new Logger(MediaDeletionWorker.name);

  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,

    private readonly storage: StorageManagerService,
  ) {}

  onModuleInit() {
    if (process.env.MEDIA_DELETE_WORKER_ENABLED === 'false') {
      return;
    }

    this.stopped = false;

    this.timer = setInterval(() => {
      void this.processNext().catch((error) => {
        this.logger.error(
          'Deletion worker error',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, POLL_INTERVAL_MS);

    void this.processNext().catch((error) => {
      this.logger.error(
        'Initial deletion worker error',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  onModuleDestroy() {
    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async claimJob() {
    return this.db.transaction(async (tx) => {
      const now = new Date();

      const [job] = await tx
        .select()
        .from(mediaDeletionJobs)
        .where(
          or(
            and(
              eq(mediaDeletionJobs.status, 'pending'),
              lte(mediaDeletionJobs.nextAttemptAt, now),
            ),
            and(
              eq(mediaDeletionJobs.status, 'processing'),
              lte(mediaDeletionJobs.lockedUntil, now),
            ),
          ),
        )
        .orderBy(
          asc(mediaDeletionJobs.nextAttemptAt),
          asc(mediaDeletionJobs.createdAt),
        )
        .for('update', { skipLocked: true })
        .limit(1);

      if (!job) return null;

      // An expired lease may be reclaimed.
      if (job.attempts >= job.maxAttempts) {
        await tx
          .update(mediaDeletionJobs)
          .set({
            status: 'failed',
            lockedUntil: null,
            lockToken: null,
          })
          .where(eq(mediaDeletionJobs.id, job.id));

        return null;
      }

      const lockToken = randomUUID();

      const [claimed] = await tx
        .update(mediaDeletionJobs)
        .set({
          status: 'processing',
          attempts: job.attempts + 1,
          lockToken,
          lockedUntil: new Date(
            now.getTime() + LEASE_MS,
          ),
        })
        .where(eq(mediaDeletionJobs.id, job.id))
        .returning();

      return claimed;
    });
  }

  private async completeJob(
    job: NonNullable<
      Awaited<ReturnType<MediaDeletionWorker['claimJob']>>
    >,
  ) {
    await this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .select()
        .from(mediaDeletionJobs)
        .where(
          and(
            eq(mediaDeletionJobs.id, job.id),
            eq(mediaDeletionJobs.status, 'processing'),
            eq(mediaDeletionJobs.lockToken, job.lockToken!),
          ),
        )
        .for('update')
        .limit(1);

      if (!claimed) return;

      await tx
        .update(mediaDeletionJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          lockToken: null,
          lockedUntil: null,
          lastError: null,
        })
        .where(eq(mediaDeletionJobs.id, job.id));

      await tx
        .update(media)
        .set({
          status: 'deleted',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(media.id, job.mediaId),
            eq(media.status, 'deleting'),
          ),
        );

      await tx.insert(mediaActivity).values({
        mediaId: job.mediaId,
        actorId: null,
        action: 'media.file_deleted',
      });
    });
  }

  private async failJob(
    job: NonNullable<
      Awaited<ReturnType<MediaDeletionWorker['claimJob']>>
    >,
    error: unknown,
  ) {
    const message = error instanceof Error
      ? error.name
      : 'STORAGE_DELETE_ERROR';

    const exhausted = job.attempts >= job.maxAttempts;

    const retrySeconds = Math.min(
      MAX_BACKOFF_SECONDS,
      10 * Math.pow(2, job.attempts - 1),
    );

    const [updated] = await this.db
      .update(mediaDeletionJobs)
      .set({
        status: exhausted ? 'failed' : 'pending',
        lastError: message.slice(0, 500),
        nextAttemptAt: new Date(
          Date.now() + retrySeconds * 1000,
        ),
        lockToken: null,
        lockedUntil: null,
      })
      .where(
        and(
          eq(mediaDeletionJobs.id, job.id),
          eq(mediaDeletionJobs.status, 'processing'),
          eq(mediaDeletionJobs.lockToken, job.lockToken!),
        ),
      )
      .returning({ id: mediaDeletionJobs.id });

    if (updated) {
      this.logger.warn(
        `Media deletion job ${job.id} attempt ` +
        `${job.attempts}/${job.maxAttempts} failed`,
      );
    }
  }

  private async processNext() {
    if (this.running || this.stopped) return;

    this.running = true;

    try {
      // Small batch, to avoid overloading the server.
      for (let i = 0; i < 5 && !this.stopped; i++) {
        const job = await this.claimJob();

        if (!job) break;

        try {
          await this.storage.delete(
            job.provider,
            job.storageKey,
          );

          await this.completeJob(job);
        } catch (error) {
          await this.failJob(job, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
