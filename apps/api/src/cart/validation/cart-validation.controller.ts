
import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import {
  CustomerAuthGuard,
} from '../../auth/guards/customer-auth.guard';

import {
  CartValidationService,
} from './cart-validation.service';

// ========================================
// GUEST CART VALIDATION
// ========================================

@Controller('cart')
export class GuestCartValidationController {
  constructor(
    private readonly validation:
      CartValidationService,
  ) {}

  @Get('validate')
  async validate(
    @Req() request: FastifyRequest,
  ) {
    const token =
      request.cookies?.cart_token;

    return {
      success: true,
      message:
        'Vérification du panier terminée.',
      data:
        await this.validation.validateGuest(
          token,
        ),
    };
  }
}

// ========================================
// AUTHENTICATED CUSTOMER VALIDATION
// ========================================

@Controller('customer/cart')
@UseGuards(CustomerAuthGuard)
export class CustomerCartValidationController {
  constructor(
    private readonly validation:
      CartValidationService,
  ) {}

  @Get('validate')
  async validate(
    @Req() request: FastifyRequest,
  ) {
    const customerId = request.customer?.id;

    if (!customerId) {
      throw new UnauthorizedException({
        success: false,
        message:
          'Authentification requise.',
      });
    }

    return {
      success: true,
      message:
        'Vérification du panier terminée.',
      data:
        await this.validation.validateCustomer(
          customerId,
        ),
    };
  }
}
