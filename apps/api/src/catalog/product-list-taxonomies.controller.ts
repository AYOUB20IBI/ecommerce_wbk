import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { z } from 'zod';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';

const idsSchema = z.array(z.uuid()).min(1).max(100);

type TaxonomyRow = {
  productId: string;
  kind: 'category' | 'tag';
  id: string;
  name: string;
};

type TaxonomyItem = {
  id: string;
  name: string;
};

type ProductTaxonomies = {
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
};

@Controller('admin/products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductListTaxonomiesController {
  constructor(
    @Inject('PRODUCT_LIFECYCLE_POOL')
    private readonly pool: Pool,
  ) {}

  @Get('list-taxonomies')
  @RequirePermissions('products.read')
  async list(@Query('ids') rawIds: unknown) {
    if (typeof rawIds !== 'string') {
      throw new BadRequestException('Invalid product IDs.');
    }

    const parsed = idsSchema.safeParse(rawIds.split(','));

    if (
      !parsed.success ||
      new Set(parsed.data).size !== parsed.data.length
    ) {
      throw new BadRequestException(
        'Provide 1–100 distinct valid product IDs.',
      );
    }

    const ids = parsed.data;

    const result = await this.pool.query<TaxonomyRow>(
      `
        SELECT
          pc.product_id AS "productId",
          'category'::text AS kind,
          c.id,
          c.name
        FROM product_categories pc
        JOIN categories c
          ON c.id = pc.category_id
        WHERE pc.product_id = ANY($1::uuid[])

        UNION ALL

        SELECT
          pt.product_id AS "productId",
          'tag'::text AS kind,
          t.id,
          t.name
        FROM product_tags pt
        JOIN tags t
          ON t.id = pt.tag_id
        WHERE pt.product_id = ANY($1::uuid[])

        ORDER BY "productId", kind, name, id
      `,
      [ids],
    );

    const items: Record<string, ProductTaxonomies> =
      Object.create(null) as Record<string, ProductTaxonomies>;

    for (const id of ids) {
      items[id] = {
        categories: [],
        tags: [],
      };
    }

    for (const row of result.rows) {
      const product = items[row.productId];

      if (!product) continue;

      const item = {
        id: row.id,
        name: row.name,
      };

      if (row.kind === 'category') {
        product.categories.push(item);
      } else if (row.kind === 'tag') {
        product.tags.push(item);
      }
    }

    return {
      success: true,
      data: items,
    };
  }
}