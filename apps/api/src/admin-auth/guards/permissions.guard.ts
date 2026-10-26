
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import {
  PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { RbacService } from '../rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    if (!request.admin) {
      throw new UnauthorizedException(
        'Admin authentication required.',
      );
    }

    const required =
      this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // Fail closed for unannotated protected routes.
    if (!required || required.length === 0) {
      throw new ForbiddenException(
        'Permission policy not configured.',
      );
    }

    const allowed = await this.rbac.hasAllPermissions(
      request.admin.id,
      required,
    );

    if (!allowed) {
      throw new ForbiddenException(
        'Permission insuffisante.',
      );
    }

    return true;
  }
}
