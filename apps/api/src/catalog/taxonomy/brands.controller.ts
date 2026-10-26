
import {
  Body, Controller, Get, Param, Patch,
  Post, Delete, Query, Req, UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../../admin-auth/decorators/require-permissions.decorator';
import { CsrfGuard } from '../../security/csrf.guard';

import {
  createBrandSchema,
  updateBrandSchema,
  taxonomyIdSchema,
  taxonomyListSchema,
} from './taxonomy.dto';
import { validate } from './taxonomy-validation';
import { TaxonomyService } from './taxonomy.service';

@Controller('admin/brands')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly service: TaxonomyService) {}

  @Post()
  @RequirePermissions('brands.create')
  @UseGuards(CsrfGuard)
  async create(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const input = validate(createBrandSchema, body);
    const data = await this.service.create(
      'brands', input, req.admin!.id,
    );
    return {
      success: true,
      message: 'Marque créée avec succès.',
      data,
    };
  }

  @Get()
  @RequirePermissions('brands.read')
  async list(@Query() query: unknown) {
    return {
      success: true,
      data: await this.service.findAll(
        'brands',
        validate(taxonomyListSchema, query),
      ),
    };
  }

  @Get(':id')
  @RequirePermissions('brands.read')
  async details(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.findOne(
        'brands', validate(taxonomyIdSchema, id),
      ),
    };
  }

  @Patch(':id')
  @RequirePermissions('brands.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Marque modifiée avec succès.',
      data: await this.service.update(
        'brands',
        validate(taxonomyIdSchema, id),
        validate(updateBrandSchema, body),
        req.admin!.id,
      ),
    };
  }

  @Delete(':id')
  @RequirePermissions('brands.delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Marque supprimée.',
      data: await this.service.remove(
        'brands',
        validate(taxonomyIdSchema, id),
        req.admin!.id,
      ),
    };
  }

  @Get(':id/activity')
  @RequirePermissions('brands.read')
  async activity(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.activity(
        'brands',
        validate(taxonomyIdSchema, id),
      ),
    };
  }
}
