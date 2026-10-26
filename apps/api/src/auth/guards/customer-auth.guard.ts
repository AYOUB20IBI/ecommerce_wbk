
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionService } from '../customer-session.service';


@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: CustomerSessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    
    const cookieName =
      process.env.NODE_ENV === 'production'
        ? '__Host-customer_session'
        : 'customer_session';

    const token = request.cookies?.[cookieName];


    if (!token) {
      throw new UnauthorizedException(
        'Authentification requise.',
      );
    }

    const session =
      await this.sessions.findValidSession(token);

    request.customer = {
      id: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    };

    return true;
  }
}
