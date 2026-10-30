
import {
  Controller,
  Get,
  Inject,
  UseGuards,
} from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';

import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';

type CountRow = {
  all: number | string;
  published: number | string;
  draft: number | string;
  private: number | string;
  trash: number | string;
};

function validCount(value: number | string): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('Invalid product count returned by database.');
  }

  return number;
}

@Controller('admin/products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductListCountsController {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  @Get('counts')
  @RequirePermissions('products.read')
  async getCounts() {
    const result = await this.db.execute<CountRow>(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE ds.product_id IS NULL
        )::integer AS "all",

        COUNT(*) FILTER (
          WHERE ds.product_id IS NULL
            AND p.status = 'published'
        )::integer AS "published",

        COUNT(*) FILTER (
          WHERE ds.product_id IS NULL
            AND p.status = 'draft'
        )::integer AS "draft",

        COUNT(*) FILTER (
          WHERE ds.product_id IS NULL
            AND p.status = 'private'
        )::integer AS "private",

        COUNT(*) FILTER (
          WHERE ds.product_id IS NOT NULL
        )::integer AS "trash"

      FROM products p

      LEFT JOIN product_deletion_state ds
        ON ds.product_id = p.id
    `);

    const row = result.rows[0];

    if (!row) {
      throw new Error('Product counters query returned no row.');
    }

    return {
      success: true,
      message: 'Compteurs produits récupérés.',
      data: {
        all: validCount(row.all),
        published: validCount(row.published),
        draft: validCount(row.draft),
        private: validCount(row.private),
        trash: validCount(row.trash),
      },
    };
  }
}
