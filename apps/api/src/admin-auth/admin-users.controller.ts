
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { AdminUsersService } from './admin-users.service';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CsrfGuard } from '../security/csrf.guard';

import { RequirePermissions } from './decorators/require-permissions.decorator';

import {
  createAdminUserSchema,
} from './dto/create-admin-user.dto';

const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(150).default(''),
});

@Controller('admin/users')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(
    private readonly usersService: AdminUsersService,
  ) {}

  @Get()
  @RequirePermissions('roles.manage')
  async listUsers(@Query() query: unknown) {
    const parsed = usersQuerySchema.safeParse(query);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid pagination or search parameters.',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await this.usersService.listUsers(
      parsed.data.page,
      parsed.data.limit,
      parsed.data.search,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Get('roles')
  @RequirePermissions('roles.manage')
  async listRoles() {
    const result = await this.usersService.listRoles();

    return {
      success: true,
      data: result,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('roles.manage')
  @UseGuards(AdminAuthGuard, PermissionsGuard, CsrfGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  async createUser(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const parsed = createAdminUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (!request.admin) {
      throw new UnauthorizedException(
        'Admin authentication required.',
      );
    }

    const result = await this.usersService.createUser(
      parsed.data,
      request.admin.id,
    );

    return {
      success: true,
      message: 'Admin account created successfully.',
      data: result,
    };
  }
}
