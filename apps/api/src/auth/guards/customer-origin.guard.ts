
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class CustomerOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const origin = request.headers.origin;

    // For the local Postman test, Origin may be absent.
    // Production policy must be stricter.
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }

      throw new ForbiddenException(
        'Origin header required.',
      );
    }

    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException(
        'Origin not allowed.',
      );
    }

    return true;
  }
}
