
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  productListSchema,
} from './dto/product.dto';

import { ProductsService } from './products.service';

// ========================================
// COMMON ZOD VALIDATION
// ========================================

function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'body';

      (errors[key] ??= []).push(issue.message);
    }

    throw new BadRequestException({
      success: false,
      message:
        'Les données fournies sont invalides.',
      errors,
    });
  }

  return result.data;
}

// ========================================
// ADMIN PRODUCTS CONTROLLER
// ========================================

@Controller('admin/products')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  // ======================================
  // CREATE SIMPLE OR VARIABLE
  // ======================================

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('products.create')
  async create(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Authentification administrateur requise.',
      });
    }

    const input = validate(
      createProductSchema,
      body,
    );

    const product = await this.productsService.create(
      input,
      admin.id,
    );

    return {
      success: true,
      message: 'Produit créé avec succès.',
      data: product,
    };
  }

  // ======================================
  // GET ALL PRODUCTS
  // ======================================

  @Get()
  @RequirePermissions('products.read')
  async findAll(@Query() query: unknown) {
    const input = validate(
      productListSchema,
      query,
    );

    return {
      success: true,
      message:
        'Produits récupérés avec succès.',
      data: await this.productsService.findAll(
        input,
      ),
    };
  }

  // ======================================
  // GET PRODUCT DETAILS
  // ======================================

  @Get(':id')
  @RequirePermissions('products.read')
  async findOne(@Param('id') id: string) {
    const productId = validate(
      productIdSchema,
      id,
    );

    return {
      success: true,
      message:
        'Produit récupéré avec succès.',
      data: await this.productsService.findOne(
        productId,
      ),
    };
  }

  // ======================================
  // UPDATE SIMPLE PRODUCT
  // ======================================

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('products.update')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Authentification administrateur requise.',
      });
    }

    const productId = validate(
      productIdSchema,
      id,
    );

    const input = validate(
      updateProductSchema,
      body,
    );

    return {
      success: true,
      message: 'Produit modifié avec succès.',
      data: await this.productsService.update(
        productId,
        input,
        admin.id,
      ),
    };
  }

  // ======================================
  // ACTIVITY HISTORY
  // ======================================

  @Get(':id/activity')
  @RequirePermissions('products.read')
  async activity(@Param('id') id: string) {
    const productId = validate(
      productIdSchema,
      id,
    );

    return {
      success: true,
      message:
        'Historique récupéré avec succès.',
      data: await this.productsService.activity(
        productId,
      ),
    };
  }
}
