import {
  BadRequestException,
  ConflictException,
  Controller,
  Inject,
  Post,
  Req,
  Body,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';
import { CsrfGuard } from '../security/csrf.guard';

const bodySchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(20),
});

type ProductRow = {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'private' | 'archived';
  deleted: boolean;
};

@Controller('admin/products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductBulkTrashController {
  constructor(
    @Inject('PRODUCT_LIFECYCLE_POOL')
    private readonly pool: Pool,
  ) {}

  @Post('bulk-trash')
  @RequirePermissions('products.delete')
  @UseGuards(CsrfGuard)
  async bulkTrash(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid product IDs.',
      });
    }

    const ids = parsed.data.ids;

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        success: false,
        message: 'Duplicate product IDs are not allowed.',
      });
    }

    const adminId = request.admin?.id;

    if (!adminId) {
      throw new UnauthorizedException(
        'Admin authentication required.',
      );
    }

    // Stable order reduces deadlock risk when multiple
    // admins perform overlapping bulk operations.
    const sortedIds = [...ids].sort();

    const client: PoolClient = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Do not let a bulk request hold locks indefinitely.
      await client.query(`SET LOCAL lock_timeout = '5s'`);
      await client.query(
        `SET LOCAL statement_timeout = '15s'`,
      );

      const products: ProductRow[] = [];

      for (const id of sortedIds) {
        const result = await client.query<ProductRow>(
          `
            SELECT
              p.id,
              p.name,
              p.status::text AS status,
              EXISTS (
                SELECT 1
                FROM product_deletion_state ds
                WHERE ds.product_id = p.id
              ) AS deleted
            FROM products p
            WHERE p.id = $1
            FOR UPDATE OF p
          `,
          [id],
        );

        const product = result.rows[0];

        if (!product) {
          throw new ConflictException({
            success: false,
            message: 'One or more products no longer exist.',
          });
        }

        if (product.deleted) {
          throw new ConflictException({
            success: false,
            message: 'One or more products are already trashed.',
          });
        }

        products.push(product);
      }

      // Every product is now validated and locked.
      // One batch insert + one batch update + one
      // batch audit insert, all in the same transaction.

      const previousStatuses = products.map(
        (product) => product.status,
      );

      await client.query(
        `
          INSERT INTO product_deletion_state (
            product_id,
            previous_status,
            deleted_by
          )
          SELECT
            x.id,
            x.previous_status::product_status,
            $3::uuid
          FROM unnest(
            $1::uuid[],
            $2::text[]
          ) AS x(id, previous_status)
        `,
        [sortedIds, previousStatuses, adminId],
      );

      await client.query(
        `
          UPDATE products
          SET
            status = 'archived',
            updated_by = $2::uuid,
            updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `,
        [sortedIds, adminId],
      );

      await client.query(
        `
          INSERT INTO product_activity (
            product_id,
            actor_id,
            action,
            changes
          )
          SELECT
            x.id,
            $3::uuid,
            'product.soft_deleted',
            jsonb_build_object(
              'previousStatus', x.previous_status,
              'newStatus', 'archived',
              'bulk', true
            )
          FROM unnest(
            $1::uuid[],
            $2::text[]
          ) AS x(id, previous_status)
        `,
        [sortedIds, previousStatuses, adminId],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: `${sortedIds.length} product(s) moved to Trash.`,
        data: {
          deletedIds: ids,
          failed: [],
        },
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}