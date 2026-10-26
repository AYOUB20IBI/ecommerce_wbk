
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { adminLoginSchema } from './dto/admin-login.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminSessionService } from './admin-session.service';
import { RbacService } from './rbac.service';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminOriginGuard } from './guards/admin-origin.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/require-permissions.decorator';

import { CsrfService } from '../security/csrf.service';
import { CsrfGuard } from '../security/csrf.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly csrfService: CsrfService,
    private readonly authService: AdminAuthService,
    private readonly sessions: AdminSessionService,
    private readonly rbacService: RbacService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminOriginGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = adminLoginSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        errors: result.error.flatten().fieldErrors,
      });
    }

    const admin =
      await this.authService.validateCredentials(result.data);

    const session =
      await this.sessions.createSession(admin.id);

    const isProduction =
      process.env.NODE_ENV === 'production';

    const cookieName = isProduction
      ? '__Host-admin_session'
      : 'admin_session';

    reply.setCookie(cookieName, session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
    });

    reply.header('Cache-Control', 'no-store');

    return {
      success: true,
      message: 'Admin connecté avec succès.',
      data: {
        admin,
      },
    };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async getMe(@Req() request: FastifyRequest) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const roles = await this.rbacService.getRoles(admin.id);

    return {
      success: true,
      message: 'Profil administrateur récupéré.',
      data: {
        admin: {
          ...admin,
          roles,
        },
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminAuthGuard, CsrfGuard)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const isProduction =
      process.env.NODE_ENV === 'production';

    const cookieName = isProduction
      ? '__Host-admin_session'
      : 'admin_session';

    const token = request.cookies?.[cookieName];

    if (token) {
      await this.sessions.revokeSession(token);
    }

    reply.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    });

    reply.header('Cache-Control', 'no-store');

    return {
      success: true,
      message: 'Déconnexion administrateur réussie.',
    };
  }

  @Get('csrf')
  @UseGuards(AdminAuthGuard)
  getCsrf(@Req() request: FastifyRequest) {
    const cookieName =
      process.env.NODE_ENV === 'production'
        ? '__Host-admin_session'
        : 'admin_session';

    const sessionToken = request.cookies?.[cookieName];

    if (!sessionToken) {
      throw new UnauthorizedException(
        'Admin session required.',
      );
    }

    return {
      success: true,
      data: {
        csrfToken: this.csrfService.generate(
          sessionToken,
          'admin',
        ),
      },
    };
  }

  @Get('check-permissions')
  @UseGuards(AdminAuthGuard, PermissionsGuard)
  @RequirePermissions('roles.manage')
  checkPermissions() {
    return {
      success: true,
      message: 'Permission granted.',
      data: {
        permission: 'roles.manage',
      },
    };
  }
}
