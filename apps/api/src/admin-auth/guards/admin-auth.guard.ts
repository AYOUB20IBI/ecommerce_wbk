
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AdminSessionService } from '../admin-session.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: AdminSessionService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const cookieName =
      process.env.NODE_ENV === 'production'
        ? '__Host-admin_session'
        : 'admin_session';

    const token = request.cookies?.[cookieName];

    if (!token) {
      throw new UnauthorizedException(
        'Authentification administrateur requise.',
      );
    }

    const session =
      await this.sessions.findValidSession(token);

    request.admin = {
      id: session.adminId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    };

    return true;
  }
}
