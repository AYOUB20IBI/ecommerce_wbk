
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CsrfService } from './csrf.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const method = request.method.toUpperCase();

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Reject requests explicitly coming from other sites.
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      throw new ForbiddenException(
        'Cross-site request rejected.',
      );
    }

    const origin = request.headers.origin;

    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    // Fail closed, even during development.
    if (!origin || !allowedOrigins.includes(origin)) {
      throw new ForbiddenException(
        'Origin not allowed.',
      );
    }

    const providedToken =
      request.headers['x-csrf-token'];

    if (typeof providedToken !== 'string') {
      throw new ForbiddenException(
        'CSRF token required.',
      );
    }

    const isProduction =
      process.env.NODE_ENV === 'production';

    const hasAdminContext = !!request.admin;
    const hasCustomerContext = !!request.customer;

    if (hasAdminContext === hasCustomerContext) {
      throw new ForbiddenException(
        'Invalid authentication context.',
      );
    }

    const scope = hasAdminContext
      ? 'admin'
      : 'customer';

    const cookieName = hasAdminContext
      ? isProduction
        ? '__Host-admin_session'
        : 'admin_session'
      : isProduction
        ? '__Host-customer_session'
        : 'customer_session';

    const sessionToken =
      request.cookies?.[cookieName];

    if (
      !sessionToken ||
      !this.csrf.verify(
        sessionToken,
        scope,
        providedToken,
      )
    ) {
      throw new ForbiddenException(
        'Invalid CSRF token.',
      );
    }

    return true;
  }
}
