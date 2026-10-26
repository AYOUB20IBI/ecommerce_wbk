
-- STEP 15.1: CART DATABASE

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NULL,
  guest_token_hash VARCHAR(64) NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'active',
  currency VARCHAR(3) NOT NULL DEFAULT 'MAD',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
    DEFAULT (NOW() + INTERVAL '30 days'),

  CONSTRAINT carts_status_check
    CHECK (status IN (
      'active', 'converted', 'abandoned'
    )),

  CONSTRAINT carts_owner_check
    CHECK (
      customer_id IS NOT NULL
      OR guest_token_hash IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS
  carts_active_guest_unique
ON carts (guest_token_hash)
WHERE guest_token_hash IS NOT NULL
  AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS
  carts_active_customer_unique
ON carts (customer_id)
WHERE customer_id IS NOT NULL
  AND status = 'active';

-- Enables composite FK validation:
-- The selected variant must belong to
-- the selected product.
CREATE UNIQUE INDEX IF NOT EXISTS
  product_variants_id_product_id_unique
ON product_variants (id, product_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cart_id UUID NOT NULL
    REFERENCES carts(id)
    ON DELETE CASCADE,

  product_id UUID NOT NULL
    REFERENCES products(id)
    ON DELETE RESTRICT,

  variant_id UUID NOT NULL,

  quantity INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cart_items_variant_product_fk
    FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants(id, product_id)
    ON DELETE RESTRICT,

  CONSTRAINT cart_items_quantity_check
    CHECK (quantity BETWEEN 1 AND 999),

  CONSTRAINT cart_items_unique_variant
    UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS
  carts_expires_at_idx
ON carts(expires_at);

CREATE INDEX IF NOT EXISTS
  cart_items_cart_id_idx
ON cart_items(cart_id);

CREATE INDEX IF NOT EXISTS
  cart_items_product_id_idx
ON cart_items(product_id);

CREATE INDEX IF NOT EXISTS
  cart_items_variant_id_idx
ON cart_items(variant_id);
