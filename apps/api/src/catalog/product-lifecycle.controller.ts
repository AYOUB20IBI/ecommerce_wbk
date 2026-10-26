
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';
import { CsrfGuard } from '../security/csrf.guard';

import { ProductLifecycleService } from './product-lifecycle.service';

const productIdSchema = z.uuid();

function validId(id: string): string {
  const result = productIdSchema.safeParse(id);

  if (!result.success) {
    throw new BadRequestException({
      success: false,
      message: 'Identifiant de produit invalide.',
    });
  }

  return result.data;
}

function getAdminId(request: FastifyRequest): string {
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
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductLifecycleController {
  constructor(
    private readonly service: ProductLifecycleService,
  ) {}

  @Delete(':id')
  @RequirePermissions('products.delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Produit supprimé avec succès.',
      data: await this.service.remove(
        validId(id),
        getAdminId(request),
      ),
    };
  }

  @Post(':id/restore')
  @RequirePermissions('products.update')
  @UseGuards(CsrfGuard)
  async restore(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Produit restauré avec succès.',
      data: await this.service.restore(
        validId(id),
        getAdminId(request),
      ),
    };
  }

  @Get(':id/deletion-status')
  @RequirePermissions('products.read')
  async status(@Param('id') id: string) {
    return {
      success: true,
      message: 'Statut de suppression récupéré.',
      data: await this.service.status(
        validId(id),
      ),
    };
  }
}
