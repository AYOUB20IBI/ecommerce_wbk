
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
  createTagSchema,
  updateTagSchema,
  taxonomyIdSchema,
  taxonomyListSchema,
} from './taxonomy.dto';
import { validate } from './taxonomy-validation';
import { TaxonomyService } from './taxonomy.service';

@Controller('admin/tags')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class TagsController {
  constructor(private readonly service: TaxonomyService) {}

  @Post()
  @RequirePermissions('tags.create')
  @UseGuards(CsrfGuard)
  async create(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Tag créé avec succès.',
      data: await this.service.create(
        'tags',
        validate(createTagSchema, body),
        req.admin!.id,
      ),
    };
  }

  @Get()
  @RequirePermissions('tags.read')
  async list(@Query() query: unknown) {
    return {
      success: true,
      data: await this.service.findAll(
        'tags',
        validate(taxonomyListSchema, query),
      ),
    };
  }

  @Get(':id')
  @RequirePermissions('tags.read')
  async details(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.findOne(
        'tags',
        validate(taxonomyIdSchema, id),
      ),
    };
  }

  @Patch(':id')
  @RequirePermissions('tags.update')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Tag modifié avec succès.',
      data: await this.service.update(
        'tags',
        validate(taxonomyIdSchema, id),
        validate(updateTagSchema, body),
        req.admin!.id,
      ),
    };
  }

  @Delete(':id')
  @RequirePermissions('tags.delete')
  @UseGuards(CsrfGuard)
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return {
      success: true,
      message: 'Tag supprimé.',
      data: await this.service.remove(
        'tags',
        validate(taxonomyIdSchema, id),
        req.admin!.id,
      ),
    };
  }

  @Get(':id/activity')
  @RequirePermissions('tags.read')
  async activity(@Param('id') id: string) {
    return {
      success: true,
      data: await this.service.activity(
        'tags',
        validate(taxonomyIdSchema, id),
      ),
    };
  }
}
