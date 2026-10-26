
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import type {
  Pool,
  PoolClient,
} from 'pg';

type CleanupCounts = {
  expiredGuestCarts: number;
  abandonedCustomerCarts: number;
  unavailableItems: number;
};

type CleanupLogRow = {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  expiredGuestCarts: number;
  abandonedCustomerCarts: number;
  unavailableItems: number;
  errorMessage: string | null;
};

@Injectable()
export class CartCleanupService {
  private readonly logger = new Logger(
    CartCleanupService.name,
  );

  private readonly batchSize = 200;

  constructor(
    @Inject('CART_CLEANUP_POOL')
    private readonly pool: Pool,
  ) {}

  // Every day at 03:00 in Casablanca.
  @Cron('0 3 * * *', {
    name: 'cart-expiration-cleanup',
    timeZone: 'Africa/Casablanca',
    waitForCompletion: true,
  })
  async scheduledCleanup(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        'Automatic cart cleanup failed.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  // ========================================
  // RUN CLEANUP
  // ========================================

  async run() {
    const client = await this.pool.connect();

    let locked = false;
    let logId: string | null = null;

    const counts: CleanupCounts = {
      expiredGuestCarts: 0,
      abandonedCustomerCarts: 0,
      unavailableItems: 0,
    };

    try {
      const lockResult = await client.query<{
        acquired: boolean;
      }>(
        `SELECT pg_try_advisory_lock(
           151, 154
         ) AS acquired`,
      );

      locked = lockResult.rows[0]?.acquired === true;

      if (!locked) {
        throw new ConflictException({
          success: false,
          message:
            'Un nettoyage est déjà en cours.',
        });
      }

      const logResult = await client.query<{
        id: string;
      }>(
        `INSERT INTO cart_cleanup_logs (
           status
         )
         VALUES ('running')
         RETURNING id`,
      );

      logId = logResult.rows[0].id;

      // 1. Expired guests.
      counts.expiredGuestCarts =
        await this.cleanExpiredGuests(client);

      // 2. Expired customers.
      counts.abandonedCustomerCarts =
        await this.abandonExpiredCustomers(client);

      // 3. Unavailable product items.
      counts.unavailableItems =
        await this.cleanUnavailableItems(client);

      await client.query(
        `UPDATE cart_cleanup_logs
         SET
           status = 'completed',
           finished_at = NOW(),
           expired_guest_carts = $2,
           abandoned_customer_carts = $3,
           unavailable_items = $4
         WHERE id = $1`,
        [
          logId,
          counts.expiredGuestCarts,
          counts.abandonedCustomerCarts,
          counts.unavailableItems,
        ],
      );

      this.logger.log(
        `Cart cleanup completed: ${JSON.stringify(counts)}`,
      );

      return {
        logId,
        status: 'completed',
        ...counts,
      };
    } catch (error) {
      if (logId) {
        try {
          await client.query(
            `UPDATE cart_cleanup_logs
             SET
               status = 'failed',
               finished_at = NOW(),
               expired_guest_carts = $2,
               abandoned_customer_carts = $3,
               unavailable_items = $4,
               error_message = $5
             WHERE id = $1`,
            [
              logId,
              counts.expiredGuestCarts,
              counts.abandonedCustomerCarts,
              counts.unavailableItems,
              error instanceof Error
                ? error.message.slice(0, 2000)
                : 'Unknown error',
            ],
          );
        } catch (loggingError) {
          this.logger.error(
            'Cannot update cleanup log.',
            loggingError instanceof Error
              ? loggingError.stack
              : String(loggingError),
          );
        }
      }

      throw error;
    } finally {
      if (locked) {
        try {
          await client.query(
            `SELECT pg_advisory_unlock(151, 154)`,
          );
        } catch (error) {
          this.logger.error(
            'Cannot release cleanup lock.',
            error instanceof Error
              ? error.stack
              : String(error),
          );
        }
      }

      client.release();
    }
  }

  // ========================================
  // EXPIRED GUEST CARTS
  // ========================================

  private async cleanExpiredGuests(
    client: PoolClient,
  ): Promise<number> {
    let total = 0;

    while (true) {
      await client.query('BEGIN');

      try {
        const result = await client.query(
          `WITH targets AS (
             SELECT id
             FROM carts
             WHERE customer_id IS NULL
               AND status = 'active'
               AND expires_at <= NOW()
             ORDER BY expires_at, id
             LIMIT $1
             FOR UPDATE SKIP LOCKED
           )
           DELETE FROM carts c
           USING targets t
           WHERE c.id = t.id
           RETURNING c.id`,
          [this.batchSize],
        );

        await client.query('COMMIT');

        const affected = result.rowCount ?? 0;
        total += affected;

        if (affected < this.batchSize) {
          break;
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return total;
  }

  // ========================================
  // EXPIRED CUSTOMER CARTS
  // ========================================

  private async abandonExpiredCustomers(
    client: PoolClient,
  ): Promise<number> {
    let total = 0;

    while (true) {
      await client.query('BEGIN');

      try {
        const result = await client.query(
          `WITH targets AS (
             SELECT id
             FROM carts
             WHERE customer_id IS NOT NULL
               AND status = 'active'
               AND expires_at <= NOW()
             ORDER BY expires_at, id
             LIMIT $1
             FOR UPDATE SKIP LOCKED
           )
           UPDATE carts c
           SET
             status = 'abandoned',
             updated_at = NOW()
           FROM targets t
           WHERE c.id = t.id
           RETURNING c.id`,
          [this.batchSize],
        );

        await client.query('COMMIT');

        const affected = result.rowCount ?? 0;
        total += affected;

        if (affected < this.batchSize) {
          break;
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return total;
  }

  // ========================================
  // UNAVAILABLE ITEMS
  // ========================================

  private async cleanUnavailableItems(
    client: PoolClient,
  ): Promise<number> {
    let total = 0;

    while (true) {
      await client.query('BEGIN');

      try {
        const result = await client.query(
          `WITH targets AS (
             SELECT ci.id
             FROM cart_items ci

             INNER JOIN carts c
               ON c.id = ci.cart_id

             INNER JOIN products p
               ON p.id = ci.product_id

             INNER JOIN product_variants v
               ON v.id = ci.variant_id

             WHERE c.status = 'active'
               AND c.expires_at > NOW()
               AND (
                 p.status <> 'published'
                 OR v.is_active = false
                 OR v.regular_price IS NULL
                 OR EXISTS (
                   SELECT 1
                   FROM product_deletion_state ds
                   WHERE ds.product_id = p.id
                 )
               )

             ORDER BY ci.id
             LIMIT $1
             FOR UPDATE OF ci SKIP LOCKED
           )
           DELETE FROM cart_items ci
           USING targets t
           WHERE ci.id = t.id
           RETURNING ci.id`,
          [this.batchSize],
        );

        await client.query('COMMIT');

        const affected = result.rowCount ?? 0;
        total += affected;

        if (affected < this.batchSize) {
          break;
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return total;
  }

  // ========================================
  // ADMIN LOGS
  // ========================================

  async getLogs(limit = 20) {
    const safeLimit = Math.min(
      Math.max(limit, 1),
      100,
    );

    const result = await this.pool.query<CleanupLogRow>(
      `SELECT
         id,
         status,
         started_at AS "startedAt",
         finished_at AS "finishedAt",
         expired_guest_carts
           AS "expiredGuestCarts",
         abandoned_customer_carts
           AS "abandonedCustomerCarts",
         unavailable_items
           AS "unavailableItems",
         error_message AS "errorMessage"

       FROM cart_cleanup_logs
       ORDER BY started_at DESC, id DESC
       LIMIT $1`,
      [safeLimit],
    );

    return result.rows;
  }
}
