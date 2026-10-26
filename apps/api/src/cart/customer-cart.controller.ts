
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { z } from 'zod';

import {
  CustomerAuthGuard,
} from '../auth/guards/customer-auth.guard';

import {
  CsrfGuard,
} from '../security/csrf.guard';

import {
  addCartItemSchema,
  cartItemIdSchema,
  updateCartItemSchema,
} from './dto/cart.dto';

import {
  CustomerCartService,
} from './customer-cart.service';

// ========================================
// VALIDATION
// ========================================

function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const errors: Record<string, string[]> = {};

  for (const issue of result.error.issues) {
    const key =
      issue.path.join('.') || 'body';

    (errors[key] ??= []).push(issue.message);
  }

  throw new BadRequestException({
    success: false,
    message:
      'Les données fournies sont invalides.',
    errors,
  });
}

function customerId(
  request: FastifyRequest,
): string {
  const id = request.customer?.id;

  if (!id) {
    throw new UnauthorizedException({
      success: false,
      message:
        'Authentification requise.',
    });
  }

  return id;
}

// ========================================
// GUEST -> CUSTOMER MERGE
// ========================================

@Controller('cart')
@UseGuards(CustomerAuthGuard)
export class CartMergeController {
  constructor(
    private readonly customerCart:
      CustomerCartService,
  ) {}

  @Post('merge')
  @UseGuards(CsrfGuard)
  async merge(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
  ) {
    const id = customerId(request);

    // Guest cart cookie is restricted to
    // /api/v1/cart, so it is accessible here.
    const guestToken =
      request.cookies?.cart_token;

    const data =
      await this.customerCart.merge(
        id,
        guestToken,
      );

    // Clear only AFTER successful merge.
    if (guestToken) {
      reply.clearCookie('cart_token', {
        path: '/api/v1/cart',
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          'production',
        sameSite: 'lax',
      });
    }

    return {
      success: true,
      message:
        'Paniers fusionnés avec succès.',
      data,
    };
  }
}

// ========================================
// AUTHENTICATED CUSTOMER CART
// ========================================

@Controller('customer/cart')
@UseGuards(CustomerAuthGuard)
export class CustomerCartController {
  constructor(
    private readonly customerCart:
      CustomerCartService,
  ) {}

  @Get()
  async getCart(
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message:
        'Panier récupéré avec succès.',
      data: await this.customerCart.getCart(
        customerId(request),
      ),
    };
  }

  @Post('items')
  @UseGuards(CsrfGuard)
  async addItem(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    const input = validate(
      addCartItemSchema,
      body,
    );

    return {
      success: true,
      message:
        'Article ajouté au panier.',
      data: await this.customerCart.addItem(
        customerId(request),
        input,
      ),
    };
  }

  @Patch('items/:id')
  @UseGuards(CsrfGuard)
  async updateItem(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const itemId = validate(
      cartItemIdSchema,
      id,
    );

    const input = validate(
      updateCartItemSchema,
      body,
    );

    return {
      success: true,
      message:
        'Panier mis à jour.',
      data: await this.customerCart.updateItem(
        customerId(request),
        itemId,
        input,
      ),
    };
  }

  @Delete('items/:id')
  @UseGuards(CsrfGuard)
  async removeItem(
    @Req() request: FastifyRequest,
    @Param('id') id: string,
  ) {
    const itemId = validate(
      cartItemIdSchema,
      id,
    );

    return {
      success: true,
      message:
        'Article supprimé du panier.',
      data: await this.customerCart.removeItem(
        customerId(request),
        itemId,
      ),
    };
  }

  @Delete('clear')
  @UseGuards(CsrfGuard)
  async clear(
    @Req() request: FastifyRequest,
  ) {
    return {
      success: true,
      message:
        'Panier vidé avec succès.',
      data: await this.customerCart.clear(
        customerId(request),
      ),
    };
  }
}
