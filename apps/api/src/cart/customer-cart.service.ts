
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import type {
  Pool,
  PoolClient,
} from 'pg';

import {
  CartService,
} from './cart.service';

type CartIdRow = {
  id: string;
};

type MergeItemRow = {
  variant_id: string;
  product_id: string;
  quantity: number;
};

type VariantRow = {
  product_id: string;
  stock_quantity: number;
  manage_stock: boolean;
};

@Injectable()
export class CustomerCartService {
  constructor(
    @Inject('CUSTOMER_CART_POOL')
    private readonly pool: Pool,

    private readonly guestCartService: CartService,
  ) {}

  // ========================================
  // FIND OR CREATE CUSTOMER CART
  // ========================================

  private async ensureCustomerCart(
    client: PoolClient,
    customerId: string,
  ): Promise<string> {
    // Serialize cart creation for this customer.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1::text, 15013)
       )`,
      [customerId],
    );

    await client.query(
      `UPDATE carts
       SET status = 'abandoned',
           updated_at = NOW()
       WHERE customer_id = $1
         AND status = 'active'
         AND expires_at <= NOW()`,
      [customerId],
    );

    const result = await client.query<CartIdRow>(
      `INSERT INTO carts (
         customer_id,
         currency,
         status
       )
       VALUES ($1, 'MAD', 'active')

       ON CONFLICT (customer_id)
       WHERE customer_id IS NOT NULL
         AND status = 'active'

       DO UPDATE SET
         updated_at = NOW(),
         expires_at = GREATEST(
           carts.expires_at,
           NOW() + INTERVAL '30 days'
         )

       RETURNING id`,
      [customerId],
    );

    return result.rows[0].id;
  }

  private async getCustomerCartId(
    customerId: string,
  ): Promise<string> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const cartId =
        await this.ensureCustomerCart(
          client,
          customerId,
        );

      await client.query('COMMIT');
      return cartId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ========================================
  // READ CUSTOMER CART
  // ========================================

  async getCart(customerId: string) {
    const cartId =
      await this.getCustomerCartId(customerId);

    return this.guestCartService.getCart(cartId);
  }

  // ========================================
  // CUSTOMER CART OPERATIONS
  // ========================================

  async addItem(
    customerId: string,
    input: {
      variantId: string;
      quantity: number;
    },
  ) {
    const cartId =
      await this.getCustomerCartId(customerId);

    return this.guestCartService.addItem(
      cartId,
      input,
    );
  }

  async updateItem(
    customerId: string,
    itemId: string,
    input: { quantity: number },
  ) {
    const cartId =
      await this.getCustomerCartId(customerId);

    return this.guestCartService.updateItem(
      cartId,
      itemId,
      input,
    );
  }

  async removeItem(
    customerId: string,
    itemId: string,
  ) {
    const cartId =
      await this.getCustomerCartId(customerId);

    return this.guestCartService.removeItem(
      cartId,
      itemId,
    );
  }

  async clear(customerId: string) {
    const cartId =
      await this.getCustomerCartId(customerId);

    return this.guestCartService.clear(cartId);
  }

  // ========================================
  // MERGE GUEST CART INTO CUSTOMER CART
  // ========================================

  async merge(
    customerId: string,
    guestToken?: string,
  ) {
    // If there is no guest cart,
    // simply return the customer cart.
    if (
      !guestToken ||
      !/^[a-f0-9]{64}$/.test(guestToken)
    ) {
      return this.getCart(customerId);
    }

    const tokenHash = createHash('sha256')
      .update(guestToken)
      .digest('hex');

    const client = await this.pool.connect();

    let customerCartId: string;

    try {
      await client.query('BEGIN');

      customerCartId =
        await this.ensureCustomerCart(
          client,
          customerId,
        );

      // Lock destination cart before merge.
      await client.query(
        `SELECT id
         FROM carts
         WHERE id = $1
         FOR UPDATE`,
        [customerCartId],
      );

      // Lock the guest cart. This also blocks
      // concurrent guest cart modifications.
      const guestResult =
        await client.query<CartIdRow>(
          `SELECT id
           FROM carts
           WHERE guest_token_hash = $1
             AND customer_id IS NULL
             AND status = 'active'
             AND expires_at > NOW()
           FOR UPDATE`,
          [tokenHash],
        );

      const guestCartId =
        guestResult.rows[0]?.id;

      if (!guestCartId) {
        await client.query('COMMIT');

        return this.guestCartService.getCart(
          customerCartId,
        );
      }

      const items =
        await client.query<MergeItemRow>(
          `SELECT
             variant_id,
             product_id,
             quantity
           FROM cart_items
           WHERE cart_id = $1
           ORDER BY variant_id`,
          [guestCartId],
        );

      for (const item of items.rows) {
        // Validate actual, currently published
        // product and variation.
        const variantResult =
          await client.query<VariantRow>(
            `SELECT
               v.product_id,
               v.stock_quantity,
               v.manage_stock
             FROM product_variants v
             JOIN products p
               ON p.id = v.product_id
             WHERE v.id = $1
               AND v.product_id = $2
               AND v.is_active = true
               AND v.regular_price IS NOT NULL
               AND p.status = 'published'
               AND NOT EXISTS (
                 SELECT 1
                 FROM product_deletion_state d
                 WHERE d.product_id = p.id
               )
             FOR SHARE OF v, p`,
            [
              item.variant_id,
              item.product_id,
            ],
          );

        const variant =
          variantResult.rows[0];

        if (!variant) {
          throw new ConflictException({
            success: false,
            message:
              'Un article du panier invité est indisponible.',
          });
        }

        const existing =
          await client.query<{
            quantity: number;
          }>(
            `SELECT quantity
             FROM cart_items
             WHERE cart_id = $1
               AND variant_id = $2`,
            [
              customerCartId,
              item.variant_id,
            ],
          );

        const nextQuantity =
          item.quantity +
          (existing.rows[0]?.quantity ?? 0);

        if (nextQuantity > 999) {
          throw new ConflictException({
            success: false,
            message:
              'La quantité maximale est 999.',
          });
        }

        if (
          variant.manage_stock &&
          nextQuantity >
            variant.stock_quantity
        ) {
          throw new ConflictException({
            success: false,
            message: 'Stock insuffisant.',
            errors: {
              variantId: [
                item.variant_id,
              ],
            },
          });
        }

        await client.query(
          `INSERT INTO cart_items (
             cart_id,
             product_id,
             variant_id,
             quantity
           )
           VALUES ($1, $2, $3, $4)

           ON CONFLICT (
             cart_id,
             variant_id
           )
           DO UPDATE SET
             quantity = EXCLUDED.quantity,
             updated_at = NOW()`,
          [
            customerCartId,
            item.product_id,
            item.variant_id,
            nextQuantity,
          ],
        );
      }

      // Guest items are moved atomically.
      await client.query(
        `DELETE FROM cart_items
         WHERE cart_id = $1`,
        [guestCartId],
      );

      await client.query(
        `UPDATE carts
         SET status = 'converted',
             updated_at = NOW()
         WHERE id = $1`,
        [guestCartId],
      );

      await client.query(
        `UPDATE carts
         SET updated_at = NOW(),
             expires_at =
               NOW() + INTERVAL '30 days'
         WHERE id = $1`,
        [customerCartId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.guestCartService.getCart(
      customerCartId!,
    );
  }
}
