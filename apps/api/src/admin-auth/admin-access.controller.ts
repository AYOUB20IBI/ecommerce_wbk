
import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RbacService } from './rbac.service';

@Controller('admin/access')
@UseGuards(AdminAuthGuard)
export class AdminAccessController {
  constructor(
    private readonly rbacService: RbacService,
  ) {}

  @Get('me')
  async getMyAccess(
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException(
        'Admin authentication required.',
      );
    }

    const [roles, permissions] = await Promise.all([
      this.rbacService.getRoles(admin.id),
      this.rbacService.getPermissions(admin.id),
    ]);

    return {
      success: true,
      data: {
        adminId: admin.id,
        roles,
        permissions,
      },
    };
  }
}
