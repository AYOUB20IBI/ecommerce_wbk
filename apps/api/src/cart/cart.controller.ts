
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { z } from 'zod';

import {
  addCartItemSchema,
  cartItemIdSchema,
  updateCartItemSchema,
} from './dto/cart.dto';

import {
  CartService,
} from './cart.service';

const CART_COOKIE = 'cart_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function validate<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const errors: Record<string, string[]> = {};

  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'body';

    (errors[field] ??= []).push(issue.message);
  }

  throw new BadRequestException({
    success: false,
    message:
      'Les données fournies sont invalides.',
    errors,
  });
}

@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
  ) {}

  // ========================================
  // GUEST TOKEN COOKIE
  // ========================================

  private async session(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = request.cookies?.[CART_COOKIE];

    const session =
      await this.cartService.resolveSession(token);

    if (session.isNew) {
      reply.setCookie(
        CART_COOKIE,
        session.token,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api/v1/cart',
          maxAge: COOKIE_MAX_AGE,
        },
      );
    }

    return session;
  }

  // ========================================
  // ORIGIN PROTECTION FOR WRITES
  // ========================================

  private checkWriteOrigin(
    origin?: string,
    contentType?: string,
  ): void {
    if (
      !contentType ||
      !contentType
        .toLowerCase()
        .startsWith('application/json')
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Content-Type application/json obligatoire.',
      });
    }

    // Postman/server requests generally do
    // not send Origin. Browser cross-origin
    // requests do send Origin.
    if (!origin) return;

    const configuredOrigins = (
      process.env.ALLOWED_ORIGINS ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const allowedOrigins =
      process.env.NODE_ENV === 'production'
        ? configuredOrigins
        : [
            ...configuredOrigins,
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
          ];

    if (!allowedOrigins.includes(origin)) {
      throw new BadRequestException({
        success: false,
        message: 'Origine non autorisée.',
      });
    }
  }

  // ========================================
  // GET CART
  // ========================================

  @Get()
  async findCart(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
  ) {
    const session =
      await this.session(request, reply);

    return {
      success: true,
      message: 'Panier récupéré avec succès.',
      data: await this.cartService.getCart(
        session.cartId,
      ),
    };
  }

  // ========================================
  // ADD ITEM
  // ========================================

  @Post('items')
  async addItem(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
    @Headers('origin') origin?: string,
    @Headers('content-type') contentType?: string,
  ) {
    this.checkWriteOrigin(origin, contentType);

    const input = validate(
      addCartItemSchema,
      body,
    );

    const session =
      await this.session(request, reply);

    return {
      success: true,
      message: 'Article ajouté au panier.',
      data: await this.cartService.addItem(
        session.cartId,
        input,
      ),
    };
  }

  // ========================================
  // UPDATE ITEM
  // ========================================

  @Patch('items/:id')
  async updateItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
    @Headers('origin') origin?: string,
    @Headers('content-type') contentType?: string,
  ) {
    this.checkWriteOrigin(origin, contentType);

    const itemId = validate(
      cartItemIdSchema,
      id,
    );

    const input = validate(
      updateCartItemSchema,
      body,
    );

    const session =
      await this.session(request, reply);

    return {
      success: true,
      message: 'Panier mis à jour.',
      data: await this.cartService.updateItem(
        session.cartId,
        itemId,
        input,
      ),
    };
  }

  // ========================================
  // REMOVE ITEM
  // ========================================

  @Delete('items/:id')
  async removeItem(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
    @Headers('origin') origin?: string,
  ) {
    this.checkDeleteOrigin(origin);

    const itemId = validate(
      cartItemIdSchema,
      id,
    );

    const session =
      await this.session(request, reply);

    return {
      success: true,
      message: 'Article supprimé du panier.',
      data: await this.cartService.removeItem(
        session.cartId,
        itemId,
      ),
    };
  }

  // ========================================
  // CLEAR CART
  // ========================================

  @Delete('clear')
  async clear(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true })
    reply: FastifyReply,
    @Headers('origin') origin?: string,
  ) {
    this.checkDeleteOrigin(origin);

    const session =
      await this.session(request, reply);

    return {
      success: true,
      message: 'Panier vidé avec succès.',
      data: await this.cartService.clear(
        session.cartId,
      ),
    };
  }

  private checkDeleteOrigin(
    origin?: string,
  ): void {
    // Same origin validation, without a JSON
    // body requirement for DELETE requests.
    this.checkWriteOrigin(
      origin,
      'application/json',
    );
  }
}
