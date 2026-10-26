
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  AdminAuthGuard,
} from '../admin-auth/guards/admin-auth.guard';

import {
  PermissionsGuard,
} from '../admin-auth/guards/permissions.guard';

import {
  RequirePermissions,
} from '../admin-auth/decorators/require-permissions.decorator';

import {
  CsrfGuard,
} from '../security/csrf.guard';

import {
  productTaxonomyIdSchema,
  updateProductTaxonomiesSchema,
} from './dto/product-taxonomy.dto';

import {
  ProductTaxonomyService,
} from './product-taxonomy.service';

function validate<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const errors: Record<string, string[]> = {};

  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'body';

    (errors[field] ??= []).push(issue.message);
  }

  throw new BadRequestException({
    success: false,
    message: 'Les données fournies sont invalides.',
    errors,
  });
}

@Controller('admin/products')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class ProductTaxonomyController {
  constructor(
    private readonly service: ProductTaxonomyService,
  ) {}

  // =======================================
  // GET PRODUCT TAXONOMIES
  // =======================================

  @Get(':id/taxonomies')
  @RequirePermissions('products.read')
  async findOne(
    @Param('id') id: string,
  ) {
    const productId = validate(
      productTaxonomyIdSchema,
      id,
    );

    return {
      success: true,
      message:
        'Relations du produit récupérées avec succès.',
      data: await this.service.findOne(productId),
    };
  }

  // =======================================
  // UPDATE PRODUCT TAXONOMIES
  // =======================================

  @Patch(':id/taxonomies')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    if (!request.admin) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Authentification administrateur requise.',
      });
    }

    const productId = validate(
      productTaxonomyIdSchema,
      id,
    );

    const input = validate(
      updateProductTaxonomiesSchema,
      body,
    );

    return {
      success: true,
      message:
        'Relations du produit modifiées avec succès.',
      data: await this.service.update(
        productId,
        input,
        request.admin.id,
      ),
    };
  }
}
