
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

import { RequirePermissions } from './decorators/require-permissions.decorator';

import { CsrfGuard } from '../security/csrf.guard';

import { AdminManagementService } from './admin-management.service';

import {
  uuidParamSchema,
  updateAdminSchema,
  roleIdsSchema,
  adminStatusSchema,
  createRoleSchema,
  updateRoleSchema,
  permissionIdsSchema,
} from './dto/manage-admin.dto';

function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new BadRequestException({
      success: false,
      message: 'Validation failed.',
      errors: result.error.flatten(),
    });
  }

  return result.data;
}

function getActorId(
  request: FastifyRequest,
): string {
  if (!request.admin) {
    throw new UnauthorizedException(
      'Admin authentication required.',
    );
  }

  return request.admin.id;
}

@Controller('admin')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
@RequirePermissions('roles.manage')
export class AdminManagementController {
  constructor(
    private readonly management: AdminManagementService,
  ) {}

  // ----------------------------
  // ADMIN USERS
  // ----------------------------

  @Get('users/:id')
  async getUser(
    @Param('id') id: string,
  ) {
    const userId = validate(
      uuidParamSchema,
      id,
    );

    return {
      success: true,
      data:
        await this.management.getUser(userId),
    };
  }

  @Patch('users/:id')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const userId = validate(
      uuidParamSchema,
      id,
    );

    const input = validate(
      updateAdminSchema,
      body,
    );

    return {
      success: true,
      data: await this.management.updateUser(
        userId,
        input,
        getActorId(request),
      ),
    };
  }

  @Put('users/:id/roles')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async updateUserRoles(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const userId = validate(
      uuidParamSchema,
      id,
    );

    const input = validate(
      roleIdsSchema,
      body,
    );

    return {
      success: true,
      data:
        await this.management.setUserRoles(
          userId,
          input.roleIds,
          getActorId(request),
        ),
    };
  }

  @Patch('users/:id/status')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const userId = validate(
      uuidParamSchema,
      id,
    );

    const input = validate(
      adminStatusSchema,
      body,
    );

    return {
      success: true,
      data:
        await this.management.setUserStatus(
          userId,
          input.isActive,
          getActorId(request),
        ),
    };
  }

  // ----------------------------
  // ROLES
  // ----------------------------

  @Get('roles')
  async listRoles() {
    return {
      success: true,
      data:
        await this.management.listRoles(),
    };
  }

  @Get('roles/:id')
  async getRole(
    @Param('id') id: string,
  ) {
    const roleId = validate(
      uuidParamSchema,
      id,
    );

    return {
      success: true,
      data:
        await this.management.getRole(roleId),
    };
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async createRole(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const input = validate(
      createRoleSchema,
      body,
    );

    return {
      success: true,
      data:
        await this.management.createRole(
          input,
          getActorId(request),
        ),
    };
  }

  @Patch('roles/:id')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async updateRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const roleId = validate(
      uuidParamSchema,
      id,
    );

    const input = validate(
      updateRoleSchema,
      body,
    );

    return {
      success: true,
      data:
        await this.management.updateRole(
          roleId,
          input,
          getActorId(request),
        ),
    };
  }

  @Put('roles/:id/permissions')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async setRolePermissions(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const roleId = validate(
      uuidParamSchema,
      id,
    );

    const input = validate(
      permissionIdsSchema,
      body,
    );

    return {
      success: true,
      data:
        await this.management.setRolePermissions(
          roleId,
          input.permissionIds,
          getActorId(request),
        ),
    };
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  async deleteRole(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    const roleId = validate(
      uuidParamSchema,
      id,
    );

    return {
      success: true,
      data:
        await this.management.deleteRole(
          roleId,
          getActorId(request),
        ),
    };
  }

  // ----------------------------
  // PERMISSIONS
  // ----------------------------

  @Get('permissions')
  async listPermissions() {
    return {
      success: true,
      data:
        await this.management.listPermissions(),
    };
  }
}
