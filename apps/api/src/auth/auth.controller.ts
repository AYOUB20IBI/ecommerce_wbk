
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { registerSchema } from './dto/register.dto';

import { Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { loginSchema } from './dto/login.dto';
import { CustomerSessionService } from './customer-session.service';



import { Get, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { CustomerOriginGuard } from './guards/customer-origin.guard';


import { Throttle } from '@nestjs/throttler';


import { CsrfService } from '../security/csrf.service';
import { CsrfGuard } from '../security/csrf.guard';



@Controller('auth')
export class AuthController {
  
  constructor(
    private readonly csrfService: CsrfService,
    private readonly authService: AuthService,
    private readonly sessionService: CustomerSessionService,
  ) {}

  
  @Throttle({
    default: {
      limit: 3,
      ttl: 60_000,
    },
  })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown) {
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      const flattened = result.error.flatten();

      const errors: Record<string, string[]> = {
        ...flattened.fieldErrors,
      };

      if (flattened.formErrors.length > 0) {
        errors._form = flattened.formErrors;
      }

      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    return this.authService.register(result.data);
  }


  
  
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const flattened = result.error.flatten();

      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        errors: {
          ...flattened.fieldErrors,
          ...(flattened.formErrors.length
            ? { _form: flattened.formErrors }
            : {}),
        },
      });
    }

    const customer =
      await this.authService.validateCustomerCredentials(
        result.data,
      );

    const session =
      await this.sessionService.createSession(customer.id);

    const isProduction =
      process.env.NODE_ENV === 'production';

    reply.setCookie(
      isProduction
        ? '__Host-customer_session'
        : 'customer_session',
      session.token,
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        expires: session.expiresAt,
      },
    );

    return {
      success: true,
      message: 'Connexion réussie.',
      data: {
        customer,
      },
    };
  }

  
  @Get('me')
  @UseGuards(CustomerAuthGuard)
  getMe(@Req() request: FastifyRequest) {
    return {
      success: true,
      message: 'Profil récupéré avec succès.',
      data: {
        customer: request.customer,
      },
    };
  }


  
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomerAuthGuard, CsrfGuard)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const isProduction =
      process.env.NODE_ENV === 'production';

    const cookieName = isProduction
      ? '__Host-customer_session'
      : 'customer_session';

    const token = request.cookies?.[cookieName];

    if (token) {
      await this.sessionService.revokeSession(token);
    }

    reply.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    });

    return {
      success: true,
      message: 'Déconnexion réussie.',
    };
  }


  
  @Get('csrf')
  @UseGuards(CustomerAuthGuard)
  getCsrf(@Req() request: FastifyRequest) {
    const isProduction =
      process.env.NODE_ENV === 'production';

    const cookieName = isProduction
      ? '__Host-customer_session'
      : 'customer_session';

    const sessionToken = request.cookies?.[cookieName];

    if (!sessionToken) {
      throw new UnauthorizedException();
    }

    return {
      success: true,
      data: {
        csrfToken: this.csrfService.generate(
          sessionToken,
          'customer',
        ),
      },
    };
  }


}
