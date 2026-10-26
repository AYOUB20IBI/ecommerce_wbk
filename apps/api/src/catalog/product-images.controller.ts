
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  imageUuidSchema,
  addProductImageSchema,
  updateProductImageSchema,
  reorderProductImagesSchema,
} from './dto/product-images.dto';

import {
  ProductImagesService,
} from './product-images.service';

// ==========================================
// VALIDATION
// ==========================================

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

// ==========================================
// ADMIN ID
// ==========================================

function getAdminId(
  request: FastifyRequest,
): string {
  if (!request.admin) {
    throw new UnauthorizedException({
      success: false,
      message:
        'Authentification administrateur requise.',
    });
  }

  return request.admin.id;
}

// ==========================================
// CONTROLLER
// ==========================================

@Controller('admin/products')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class ProductImagesController {
  constructor(
    private readonly service: ProductImagesService,
  ) {}

  // ========================================
  // GET GALLERY
  // ========================================

  @Get(':id/images')
  @RequirePermissions('products.read')
  async findAll(
    @Param('id') id: string,
  ) {
    const productId = validate(
      imageUuidSchema,
      id,
    );

    return {
      success: true,
      message:
        'Galerie récupérée avec succès.',
      data: await this.service.findAll(productId),
    };
  }

  // ========================================
  // ADD IMAGE
  // ========================================

  @Post(':id/images')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async add(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const productId = validate(
      imageUuidSchema,
      id,
    );

    const input = validate(
      addProductImageSchema,
      body,
    );

    return {
      success: true,
      message:
        'Image ajoutée à la galerie avec succès.',
      data: await this.service.add(
        productId,
        input,
        getAdminId(request),
      ),
    };
  }

  // ========================================
  // REORDER
  // ========================================

  @Put(':id/images/order')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async reorder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const productId = validate(
      imageUuidSchema,
      id,
    );

    const input = validate(
      reorderProductImagesSchema,
      body,
    );

    return {
      success: true,
      message:
        'Ordre des images modifié avec succès.',
      data: await this.service.reorder(
        productId,
        input,
        getAdminId(request),
      ),
    };
  }

  // ========================================
  // UPDATE IMAGE
  // ========================================

  @Patch(':id/images/:imageId')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const productId = validate(
      imageUuidSchema,
      id,
    );

    const validImageId = validate(
      imageUuidSchema,
      imageId,
    );

    const input = validate(
      updateProductImageSchema,
      body,
    );

    return {
      success: true,
      message:
        'Image modifiée avec succès.',
      data: await this.service.update(
        productId,
        validImageId,
        input,
        getAdminId(request),
      ),
    };
  }

  // ========================================
  // REMOVE IMAGE
  // ========================================

  @Delete(':id/images/:imageId')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() request: FastifyRequest,
  ) {
    const productId = validate(
      imageUuidSchema,
      id,
    );

    const validImageId = validate(
      imageUuidSchema,
      imageId,
    );

    return {
      success: true,
      message:
        'Image retirée de la galerie avec succès.',
      data: await this.service.remove(
        productId,
        validImageId,
        getAdminId(request),
      ),
    };
  }
}
