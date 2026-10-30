
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE } from '../database/database.provider';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';

const productIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(100);

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
};

type AuthorRow = {
  productId: string;
  createdById: string | null;
  createdFirstName: string | null;
  createdLastName: string | null;
  createdEmail: string | null;
  updatedById: string | null;
  updatedFirstName: string | null;
  updatedLastName: string | null;
  updatedEmail: string | null;
};

function author(
  id: string | null,
  firstName: string | null,
  lastName: string | null,
  email: string | null,
) {
  if (!id) return null;

  const name =
    [firstName, lastName]
      .filter((value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim() || email || 'Unknown admin';

  return { id, name };
}

@Controller('admin/products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductListPresentationController {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  @Get('category-tree')
  @RequirePermissions('products.read', 'categories.read')
  async categoryTree() {
    // Fetch only the columns needed by the filter.
    // The extra row detects accidental truncation.
    const result = await this.db.execute<CategoryRow>(sql`
      SELECT
        id,
        name,
        parent_id AS "parentId"
      FROM categories
      ORDER BY name ASC, id ASC
      LIMIT 5001
    `);

    if (result.rows.length > 5000) {
      throw new BadRequestException(
        'Too many categories for the tree endpoint.',
      );
    }

    return {
      success: true,
      data: {
        items: result.rows,
      },
    };
  }

  @Get('authors')
  @RequirePermissions('products.read')
  async authors(@Query('ids') rawIds: unknown) {
    if (
      typeof rawIds !== 'string' ||
      rawIds.length > 3700
    ) {
      throw new BadRequestException(
        'Invalid product IDs.',
      );
    }

    const parsed = productIdsSchema.safeParse(
      rawIds.split(','),
    );

    if (
      !parsed.success ||
      new Set(parsed.data).size !== parsed.data.length
    ) {
      throw new BadRequestException(
        'Provide 1–100 distinct product IDs.',
      );
    }

    const ids = parsed.data;

    const result = await this.db.execute<AuthorRow>(sql`
      SELECT
        p.id AS "productId",

        creator.id AS "createdById",
        creator.first_name AS "createdFirstName",
        creator.last_name AS "createdLastName",
        creator.email AS "createdEmail",

        editor.id AS "updatedById",
        editor.first_name AS "updatedFirstName",
        editor.last_name AS "updatedLastName",
        editor.email AS "updatedEmail"

      FROM products p

      LEFT JOIN admin_users creator
        ON creator.id = p.created_by

      LEFT JOIN admin_users editor
        ON editor.id = p.updated_by

      WHERE p.id IN (
        ${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}
      )
    `);

    const items: Record<
      string,
      {
        createdBy: ReturnType<typeof author>;
        updatedBy: ReturnType<typeof author>;
      }
    > = Object.create(null) as Record<
      string,
      {
        createdBy: ReturnType<typeof author>;
        updatedBy: ReturnType<typeof author>;
      }
    >;

    for (const row of result.rows) {
      items[row.productId] = {
        createdBy: author(
          row.createdById,
          row.createdFirstName,
          row.createdLastName,
          row.createdEmail,
        ),
        updatedBy: author(
          row.updatedById,
          row.updatedFirstName,
          row.updatedLastName,
          row.updatedEmail,
        ),
      };
    }

    return {
      success: true,
      data: { items },
    };
  }
}
