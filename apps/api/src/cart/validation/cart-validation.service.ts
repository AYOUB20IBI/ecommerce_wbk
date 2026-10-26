
import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  createHash,
} from 'node:crypto';

import type {
  Pool,
  PoolClient,
} from 'pg';

type Owner =
  | { kind: 'guest'; token: string }
  | { kind: 'customer'; customerId: string };

type CartRow = {
  id: string;
  currency: string;
  expiresAt: Date;
};

type ItemRow = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  name: string | null;
  slug: string | null;
  productType: string | null;
  productStatus: string | null;
  variantActive: boolean | null;
  regularPrice: string | null;
  salePrice: string | null;
  stockQuantity: number | null;
  manageStock: boolean | null;
  isDeleted: boolean;
};

type IssueCode =
  | 'PRODUCT_UNAVAILABLE'
  | 'VARIANT_UNAVAILABLE'
  | 'PRICE_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK';

type Issue = {
  code: IssueCode;
  itemId: string;
  productId: string;
  variantId: string;
  message: string;
  availableQuantity?: number;
};

function tokenHash(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');

  return BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));
}

function formatMoney(cents: bigint): string {
  const whole = cents / 100n;

  const fraction = (cents % 100n)
    .toString()
    .padStart(2, '0');

  return `${whole}.${fraction}`;
}

@Injectable()
export class CartValidationService {
  constructor(
    @Inject('CART_VALIDATION_POOL')
    private readonly pool: Pool,
  ) {}

  // =====================================
  // GUEST CART
  // =====================================

  async validateGuest(token?: string) {
    if (
      !token ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      throw this.cartNotFound();
    }

    return this.validate({
      kind: 'guest',
      token,
    });
  }

  // =====================================
  // CUSTOMER CART
  // =====================================

  async validateCustomer(customerId: string) {
    return this.validate({
      kind: 'customer',
      customerId,
    });
  }

  // =====================================
  // GENERIC VALIDATION
  // =====================================

  private async validate(owner: Owner) {
    const client = await this.pool.connect();

    try {
      // This gives the preview a consistent
      // read snapshot without modifying Cart.
      await client.query(
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );

      const cart = await this.findCart(
        client,
        owner,
      );

      if (!cart) {
        throw this.cartNotFound();
      }

      const items = await this.loadItems(
        client,
        cart.id,
      );

      const issues: Issue[] = [];
      let subtotalCents = 0n;
      let quantityTotal = 0;

      const reviewedItems = items.map((item) => {
        const itemIssues: Issue[] = [];

        const addIssue = (
          issue: Omit<
            Issue,
            'itemId' | 'productId' | 'variantId'
          >,
        ) => {
          const fullIssue: Issue = {
            itemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            ...issue,
          };

          itemIssues.push(fullIssue);
          issues.push(fullIssue);
        };

        const productAvailable =
          item.name !== null &&
          item.productStatus === 'published' &&
          !item.isDeleted;

        if (!productAvailable) {
          addIssue({
            code: 'PRODUCT_UNAVAILABLE',
            message:
              'Ce produit n’est plus disponible.',
          });
        }

        const variantAvailable =
          item.variantActive === true;

        if (!variantAvailable) {
          addIssue({
            code: 'VARIANT_UNAVAILABLE',
            message:
              'Cette variation n’est plus disponible.',
          });
        }

        const priceAvailable =
          item.regularPrice !== null;

        if (!priceAvailable) {
          addIssue({
            code: 'PRICE_UNAVAILABLE',
            message:
              'Le prix de cet article est indisponible.',
          });
        }

        const availableQuantity =
          item.manageStock === true
            ? item.stockQuantity ?? 0
            : null;

        if (
          productAvailable &&
          variantAvailable &&
          priceAvailable &&
          item.manageStock === true
        ) {
          if (availableQuantity === 0) {
            addIssue({
              code: 'OUT_OF_STOCK',
              message:
                'Cet article est en rupture de stock.',
              availableQuantity: 0,
            });
          } else if (
            availableQuantity !== null &&
            item.quantity > availableQuantity
          ) {
            addIssue({
              code: 'INSUFFICIENT_STOCK',
              message:
                'La quantité demandée dépasse le stock disponible.',
              availableQuantity,
            });
          }
        }

        const unitPrice =
          productAvailable &&
          variantAvailable &&
          priceAvailable
            ? item.salePrice ??
              item.regularPrice
            : null;

        const lineTotal =
          unitPrice !== null
            ? toCents(unitPrice) *
              BigInt(item.quantity)
            : null;

        if (lineTotal !== null) {
          subtotalCents += lineTotal;
        }

        quantityTotal += item.quantity;

        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,

          product: {
            name: item.name,
            slug: item.slug,
            type: item.productType,
          },

          quantity: item.quantity,
          availableQuantity,

          regularPrice:
            productAvailable &&
            variantAvailable
              ? item.regularPrice
              : null,

          salePrice:
            productAvailable &&
            variantAvailable
              ? item.salePrice
              : null,

          unitPrice,
          lineTotal:
            lineTotal !== null
              ? formatMoney(lineTotal)
              : null,

          isValid: itemIssues.length === 0,
          issues: itemIssues,
        };
      });

      const canCheckout =
        reviewedItems.length > 0 &&
        issues.length === 0;

      await client.query('COMMIT');

      return {
        cartId: cart.id,
        currency: cart.currency,

        canCheckout,

        items: reviewedItems,
        issues,

        summary: {
          itemsCount: reviewedItems.length,
          quantityTotal,

          // Partial amount only when some
          // products are unavailable.
          subtotal:
            issues.length === 0
              ? formatMoney(subtotalCents)
              : null,

          shipping: null,
          tax: null,
          discount: null,
          total: null,
        },

        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================
  // OWNER-BOUND CART LOOKUP
  // =====================================

  private async findCart(
    client: PoolClient,
    owner: Owner,
  ): Promise<CartRow | null> {
    const condition =
      owner.kind === 'guest'
        ? 'guest_token_hash = $1'
        : 'customer_id = $1';

    const value =
      owner.kind === 'guest'
        ? tokenHash(owner.token)
        : owner.customerId;

    // condition is a fixed, internal SQL
    // fragment, never user-controlled.
    const result = await client.query<CartRow>(
      `SELECT
         id,
         currency,
         expires_at AS "expiresAt"
       FROM carts
       WHERE ${condition}
         AND status = 'active'
         AND expires_at > NOW()
       LIMIT 1`,
      [value],
    );

    return result.rows[0] ?? null;
  }

  // =====================================
  // LOAD ALL ITEMS, INCLUDING INVALID
  // =====================================

  private async loadItems(
    client: PoolClient,
    cartId: string,
  ): Promise<ItemRow[]> {
    const result = await client.query<ItemRow>(
      `SELECT
         ci.id,
         ci.product_id AS "productId",
         ci.variant_id AS "variantId",
         ci.quantity,

         p.name,
         p.slug,
         p.type::text AS "productType",
         p.status::text AS "productStatus",

         v.is_active AS "variantActive",
         v.regular_price AS "regularPrice",
         v.sale_price AS "salePrice",
         v.stock_quantity AS "stockQuantity",
         v.manage_stock AS "manageStock",

         EXISTS (
           SELECT 1
           FROM product_deletion_state ds
           WHERE ds.product_id = ci.product_id
         ) AS "isDeleted"

       FROM cart_items ci

       LEFT JOIN products p
         ON p.id = ci.product_id

       LEFT JOIN product_variants v
         ON v.id = ci.variant_id
         AND v.product_id = ci.product_id

       WHERE ci.cart_id = $1

       ORDER BY
         ci.created_at ASC,
         ci.id ASC`,
      [cartId],
    );

    return result.rows;
  }

  private cartNotFound() {
    return new NotFoundException({
      success: false,
      message:
        'Panier introuvable ou expiré.',
    });
  }
}
