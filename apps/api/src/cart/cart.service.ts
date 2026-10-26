
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  createHash,
  randomBytes,
} from 'node:crypto';

import type {
  Pool,
  PoolClient,
} from 'pg';

import type {
  AddCartItemInput,
  UpdateCartItemInput,
} from './dto/cart.dto';

type CartRow = {
  id: string;
  guest_token_hash: string;
};

type VariantRow = {
  product_id: string;
  regular_price: string | null;
  sale_price: string | null;
  stock_quantity: number;
  manage_stock: boolean;
};

type ItemRow = {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  type: string;
  sku: string | null;
  quantity: number;
  regularPrice: string;
  salePrice: string | null;
  stockQuantity: number;
  manageStock: boolean;
  image: unknown;
};

type CartSession = {
  cartId: string;
  token: string;
  isNew: boolean;
};

function hashToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

function cents(value: string): bigint {
  const [whole, decimal = ''] = value.split('.');

  return BigInt(whole) * 100n +
    BigInt(decimal.padEnd(2, '0'));
}

function money(value: bigint): string {
  const whole = value / 100n;
  const decimal = (value % 100n)
    .toString()
    .padStart(2, '0');

  return `${whole}.${decimal}`;
}

@Injectable()
export class CartService {
  constructor(
    @Inject('CART_POOL')
    private readonly pool: Pool,
  ) {}

  // ========================================
  // GUEST SESSION
  // ========================================

  async resolveSession(
    existingToken?: string,
  ): Promise<CartSession> {
    if (
      existingToken &&
      /^[a-f0-9]{64}$/.test(existingToken)
    ) {
      const tokenHash = hashToken(existingToken);

      const result = await this.pool.query<{
        id: string;
      }>(
        `SELECT id
         FROM carts
         WHERE guest_token_hash = $1
           AND status = 'active'
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash],
      );

      if (result.rows[0]) {
        return {
          cartId: result.rows[0].id,
          token: existingToken,
          isNew: false,
        };
      }
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const result = await this.pool.query<{
      id: string;
    }>(
      `INSERT INTO carts (
         guest_token_hash,
         status,
         currency
       )
       VALUES ($1, 'active', 'MAD')
       RETURNING id`,
      [tokenHash],
    );

    return {
      cartId: result.rows[0].id,
      token,
      isNew: true,
    };
  }

  // ========================================
  // CHECK CART LOCK
  // ========================================

  private async lockCart(
    client: PoolClient,
    cartId: string,
  ): Promise<void> {
    const result = await client.query(
      `SELECT id
       FROM carts
       WHERE id = $1
         AND status = 'active'
         AND expires_at > NOW()
       FOR UPDATE`,
      [cartId],
    );

    if (!result.rowCount) {
      throw new NotFoundException({
        success: false,
        message: 'Panier introuvable ou expiré.',
      });
    }
  }

  // ========================================
  // VALIDATE SELLABLE VARIANT
  // ========================================

  private async getVariant(
    client: PoolClient,
    variantId: string,
  ): Promise<VariantRow> {
    const result = await client.query<VariantRow>(
      `SELECT
         v.product_id,
         v.regular_price,
         v.sale_price,
         v.stock_quantity,
         v.manage_stock

       FROM product_variants v

       INNER JOIN products p
         ON p.id = v.product_id

       WHERE v.id = $1
         AND v.is_active = true
         AND v.regular_price IS NOT NULL
         AND p.status = 'published'

         AND NOT EXISTS (
           SELECT 1
           FROM product_deletion_state ds
           WHERE ds.product_id = p.id
         )

       FOR SHARE OF v, p`,
      [variantId],
    );

    const variant = result.rows[0];

    if (!variant) {
      throw new BadRequestException({
        success: false,
        message:
          'Cette variation est indisponible.',
      });
    }

    return variant;
  }

  private checkStock(
    variant: VariantRow,
    quantity: number,
  ): void {
    if (
      variant.manage_stock &&
      quantity > variant.stock_quantity
    ) {
      throw new ConflictException({
        success: false,
        message: 'Stock insuffisant.',
        errors: {
          quantity: [
            `Stock disponible : ${variant.stock_quantity}.`,
          ],
        },
      });
    }
  }

  // ========================================
  // ADD ITEM
  // ========================================

  async addItem(
    cartId: string,
    input: AddCartItemInput,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await this.lockCart(client, cartId);

      const variant = await this.getVariant(
        client,
        input.variantId,
      );

      const existing = await client.query<{
        quantity: number;
      }>(
        `SELECT quantity
         FROM cart_items
         WHERE cart_id = $1
           AND variant_id = $2`,
        [cartId, input.variantId],
      );

      const nextQuantity =
        (existing.rows[0]?.quantity ?? 0) +
        input.quantity;

      if (nextQuantity > 999) {
        throw new BadRequestException({
          success: false,
          message:
            'La quantité maximale est 999.',
        });
      }

      this.checkStock(variant, nextQuantity);

      await client.query(
        `INSERT INTO cart_items (
           cart_id,
           product_id,
           variant_id,
           quantity
         )
         VALUES ($1, $2, $3, $4)

         ON CONFLICT (cart_id, variant_id)
         DO UPDATE SET
           quantity = EXCLUDED.quantity,
           updated_at = NOW()`,
        [
          cartId,
          variant.product_id,
          input.variantId,
          nextQuantity,
        ],
      );

      await client.query(
        `UPDATE carts
         SET updated_at = NOW()
         WHERE id = $1`,
        [cartId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCart(cartId);
  }

  // ========================================
  // UPDATE ITEM QUANTITY
  // ========================================

  async updateItem(
    cartId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await this.lockCart(client, cartId);

      const result = await client.query<{
        variant_id: string;
      }>(
        `SELECT variant_id
         FROM cart_items
         WHERE id = $1
           AND cart_id = $2`,
        [itemId, cartId],
      );

      const item = result.rows[0];

      if (!item) {
        throw new NotFoundException({
          success: false,
          message: 'Article introuvable.',
        });
      }

      const variant = await this.getVariant(
        client,
        item.variant_id,
      );

      this.checkStock(variant, input.quantity);

      await client.query(
        `UPDATE cart_items
         SET quantity = $1,
             updated_at = NOW()
         WHERE id = $2
           AND cart_id = $3`,
        [
          input.quantity,
          itemId,
          cartId,
        ],
      );

      await client.query(
        `UPDATE carts
         SET updated_at = NOW()
         WHERE id = $1`,
        [cartId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCart(cartId);
  }

  // ========================================
  // REMOVE ITEM
  // ========================================

  async removeItem(
    cartId: string,
    itemId: string,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await this.lockCart(client, cartId);

      const result = await client.query(
        `DELETE FROM cart_items
         WHERE id = $1
           AND cart_id = $2
         RETURNING id`,
        [itemId, cartId],
      );

      if (!result.rowCount) {
        throw new NotFoundException({
          success: false,
          message: 'Article introuvable.',
        });
      }

      await client.query(
        `UPDATE carts
         SET updated_at = NOW()
         WHERE id = $1`,
        [cartId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCart(cartId);
  }

  // ========================================
  // CLEAR CART
  // ========================================

  async clear(cartId: string) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await this.lockCart(client, cartId);

      await client.query(
        `DELETE FROM cart_items
         WHERE cart_id = $1`,
        [cartId],
      );

      await client.query(
        `UPDATE carts
         SET updated_at = NOW()
         WHERE id = $1`,
        [cartId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getCart(cartId);
  }

  // ========================================
  // GET CART AND RECALCULATE PRICES
  // ========================================

  async getCart(cartId: string) {
    const result = await this.pool.query<ItemRow>(
      `SELECT
         ci.id,
         ci.product_id AS "productId",
         ci.variant_id AS "variantId",
         ci.quantity,

         p.name,
         p.slug,
         p.type::text AS type,

         v.sku,
         v.regular_price AS "regularPrice",
         v.sale_price AS "salePrice",
         v.stock_quantity AS "stockQuantity",
         v.manage_stock AS "manageStock",

         image.image AS image

       FROM cart_items ci

       INNER JOIN products p
         ON p.id = ci.product_id

       INNER JOIN product_variants v
         ON v.id = ci.variant_id
         AND v.product_id = p.id

       LEFT JOIN LATERAL (
         SELECT jsonb_build_object(
           'mediaId', m.id,
           'externalUrl', m.external_url,
           'altText', m.alt_text
         ) AS image

         FROM product_images pi
         INNER JOIN media m
           ON m.id = pi.media_id

         WHERE pi.product_id = p.id
           AND m.status = 'ready'
           AND (
             pi.variant_id = v.id
             OR pi.variant_id IS NULL
           )

         ORDER BY
           CASE
             WHEN pi.variant_id = v.id
             THEN 0 ELSE 1
           END,
           pi.is_featured DESC,
           pi.position ASC

         LIMIT 1
       ) image ON TRUE

       WHERE ci.cart_id = $1
         AND p.status = 'published'
         AND v.is_active = true
         AND v.regular_price IS NOT NULL

         AND NOT EXISTS (
           SELECT 1
           FROM product_deletion_state ds
           WHERE ds.product_id = p.id
         )

       ORDER BY ci.created_at, ci.id`,
      [cartId],
    );

    let subtotal = 0n;
    let quantityTotal = 0;

    const items = result.rows.map((item) => {
      const actualPrice =
        item.salePrice ?? item.regularPrice;

      const unitCents = cents(actualPrice);
      const lineCents =
        unitCents * BigInt(item.quantity);

      subtotal += lineCents;
      quantityTotal += item.quantity;

      const inStock =
        !item.manageStock ||
        item.stockQuantity >= item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        slug: item.slug,
        type: item.type,
        sku: item.sku,
        quantity: item.quantity,

        regularPrice: item.regularPrice,
        salePrice: item.salePrice,
        unitPrice: money(unitCents),
        lineTotal: money(lineCents),

        inStock,
        availableStock: item.manageStock
          ? item.stockQuantity
          : null,

        image: item.image,
      };
    });

    return {
      id: cartId,
      currency: 'MAD',
      items,

      summary: {
        itemsCount: items.length,
        quantityTotal,
        subtotal: money(subtotal),

        // Shipping/taxes/discounts will
        // be calculated during checkout.
        shipping: null,
        tax: null,
        discount: null,
        total: null,

        canCheckout: items.every(
          (item) => item.inStock,
        ),
      },
    };
  }
}
