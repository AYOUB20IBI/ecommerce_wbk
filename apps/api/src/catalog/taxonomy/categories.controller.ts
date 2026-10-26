
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
  createCategorySchema,
  updateCategorySchema,
  taxonomyIdSchema,
  taxonomyListSchema,
} from './taxonomy.dto';

import { validate } from './taxonomy-validation';
import { TaxonomyService } from './taxonomy.service';

@Controller('admin/categories')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly service: TaxonomyService) {}

  @Post()
  @RequirePermissions('categories.create')
  @UseGuards(CsrfGuard)
  async create(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Catégorie créée avec succès.',
      data: await this.service.create(
        'categories',
        validate(createCategorySchema, body),
        req.admin!.id,
      ),
    };
  }

  @Get()
  @RequirePermissions('categories.read')
  async list(@Query() query: unknown) {
    return {
      success: true,
      data: await this.service.findAll(
        'categories',
        validate(taxonomyListSchema, query),
      ),
    };
  }

  @Get(':id')
  @RequirePermissions('categories.read')
  async details(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.findOne(
        'categories',
        validate(taxonomyIdSchema, id),
      ),
    };
  }

  @Patch(':id')
  @RequirePermissions('categories.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Catégorie modifiée avec succès.',
      data: await this.service.update(
        'categories',
        validate(taxonomyIdSchema, id),
        validate(updateCategorySchema, body),
        req.admin!.id,
      ),
    };
  }

  @Delete(':id')
  @RequirePermissions('categories.delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Catégorie supprimée.',
      data: await this.service.remove(
        'categories',
        validate(taxonomyIdSchema, id),
        req.admin!.id,
      ),
    };
  }

  @Get(':id/activity')
  @RequirePermissions('categories.read')
  async activity(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.activity(
        'categories',
        validate(taxonomyIdSchema, id),
      ),
    };
  }
}
