
import {
  BadRequestException,
  Controller,
  Delete,
  Headers,
  Param,
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
  ProductPurgeService,
} from './product-purge.service';

const uuidSchema = z.uuid();

@Controller('admin/products')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class ProductPurgeController {
  constructor(
    private readonly service: ProductPurgeService,
  ) {}

  @Delete(':id/permanent')
  @RequirePermissions('products.purge')
  @UseGuards(CsrfGuard)
  async purge(
    @Param('id') id: string,
    @Headers('x-confirm-permanent-delete')
    confirmation: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const result = uuidSchema.safeParse(id);

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        message: 'Identifiant du produit invalide.',
      });
    }

    if (
      confirmation !== result.data
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Confirmation explicite requise : envoyez l’identifiant du produit dans X-Confirm-Permanent-Delete.',
      });
    }

    if (!request.admin) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Authentification administrateur requise.',
      });
    }

    const data = await this.service.purge(
      result.data,
      request.admin.id,
    );

    return {
      success: true,
      message:
        'Produit supprimé définitivement avec succès.',
      data,
    };
  }
}
