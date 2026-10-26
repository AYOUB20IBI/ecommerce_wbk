
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  createVariantSchema,
  updateVariantSchema,
  updateVariableProductSchema,
  variableProductIdSchema,
} from './dto/variable-product.dto';

import {
  VariableProductsService,
} from './variable-products.service';

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

function adminId(request: FastifyRequest): string {
  if (!request.admin) {
    throw new UnauthorizedException({
      success: false,
      message:
        'Authentification administrateur requise.',
    });
  }

  return request.admin.id;
}

@Controller('admin/products')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class VariableProductsController {
  constructor(
    private readonly service: VariableProductsService,
  ) {}

  // ======================================
  // UPDATE VARIABLE PRODUCT
  // ======================================

  @Patch(':id/variable')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async updateProduct(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const input = validate(
      updateVariableProductSchema,
      body,
    );

    const data = await this.service.updateProduct(
      validate(variableProductIdSchema, id),
      input,
      adminId(request),
    );

    return {
      success: true,
      message: 'Produit variable modifié avec succès.',
      data,
    };
  }

  // ======================================
  // LIST VARIANTS
  // ======================================

  @Get(':id/variants')
  @RequirePermissions('products.read')
  async findAll(
    @Param('id') id: string,
  ) {
    return {
      success: true,
      message:
        'Variations récupérées avec succès.',
      data: await this.service.findAll(
        validate(variableProductIdSchema, id),
      ),
    };
  }

  // ======================================
  // CREATE VARIANT
  // ======================================

  @Post(':id/variants')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async create(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const input = validate(
      createVariantSchema,
      body,
    );

    const data = await this.service.create(
      validate(variableProductIdSchema, id),
      input,
      adminId(request),
    );

    return {
      success: true,
      message: 'Variation créée avec succès.',
      data,
    };
  }

  // ======================================
  // UPDATE VARIANT
  // ======================================

  @Patch(':id/variants/:variantId')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const input = validate(
      updateVariantSchema,
      body,
    );

    const data = await this.service.update(
      validate(variableProductIdSchema, id),
      validate(variableProductIdSchema, variantId),
      input,
      adminId(request),
    );

    return {
      success: true,
      message: 'Variation modifiée avec succès.',
      data,
    };
  }

  // ======================================
  // CHANGE DEFAULT VARIANT
  // ======================================

  @Patch(':id/variants/:variantId/default')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async setDefault(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message:
        'Variation par défaut modifiée avec succès.',
      data: await this.service.setDefault(
        validate(variableProductIdSchema, id),
        validate(variableProductIdSchema, variantId),
        adminId(request),
      ),
    };
  }

  // ======================================
  // SAFE DELETE / DEACTIVATE VARIANT
  // ======================================

  @Delete(':id/variants/:variantId')
  @RequirePermissions('products.delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message:
        'Variation désactivée avec succès.',
      data: await this.service.remove(
        validate(variableProductIdSchema, id),
        validate(variableProductIdSchema, variantId),
        adminId(request),
      ),
    };
  }
}
