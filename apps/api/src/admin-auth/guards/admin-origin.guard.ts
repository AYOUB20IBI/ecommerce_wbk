
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AdminOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const fetchSite = request.headers['sec-fetch-site'];

    // Reject browser requests explicitly marked cross-site.
    if (fetchSite === 'cross-site') {
      throw new ForbiddenException(
        'Cross-site admin request rejected.',
      );
    }

    const origin = request.headers.origin;

    // Admin login requires an Origin, including in development.
    if (!origin || Array.isArray(origin)) {
      throw new ForbiddenException(
        'Origin header required for admin login.',
      );
    }

    const allowedOrigins = new Set(
      (process.env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );

    if (!allowedOrigins.has(origin)) {
      throw new ForbiddenException(
        'Origin not allowed for admin login.',
      );
    }

    return true;
  }
}
