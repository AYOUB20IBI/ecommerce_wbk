
import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

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
  bulkProductIdSchema,
  bulkProductImagesSchema,
} from './dto/bulk-product-images.dto';

import {
  BulkProductImagesService,
} from './bulk-product-images.service';

@Controller('admin/products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class BulkProductImagesController {
  constructor(
    private readonly service: BulkProductImagesService,
  ) {}

  @Post(':id/images/bulk')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async addBulk(
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

    const product = bulkProductIdSchema.safeParse(id);

    if (!product.success) {
      throw new BadRequestException({
        success: false,
        message: 'Identifiant du produit invalide.',
      });
    }

    const parsed = bulkProductImagesSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message:
          'Les données de la galerie sont invalides.',
        errors: parsed.error.issues.map(
          (issue) => ({
            field:
              issue.path.join('.') || 'images',
            message: issue.message,
          }),
        ),
      });
    }

    return {
      success: true,
      message:
        'Les images ont été ajoutées avec succès.',
      data: await this.service.addBulk(
        product.data,
        parsed.data,
        request.admin.id,
      ),
    };
  }
}
