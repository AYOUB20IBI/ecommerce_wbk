
-- ==========================================
-- STEP 15.1.4 - CART CLEANUP LOGS
-- ==========================================

CREATE TABLE IF NOT EXISTS cart_cleanup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,

  status VARCHAR(20) NOT NULL DEFAULT 'running',

  expired_guest_carts INTEGER NOT NULL DEFAULT 0,
  abandoned_customer_carts INTEGER NOT NULL DEFAULT 0,
  unavailable_items INTEGER NOT NULL DEFAULT 0,

  error_message TEXT,

  CONSTRAINT cart_cleanup_logs_status_check
    CHECK (
      status IN (
        'running',
        'completed',
        'failed'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  cart_cleanup_logs_started_at_idx
ON cart_cleanup_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS
  carts_cleanup_active_expiry_idx
ON carts(expires_at)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS
  cart_items_cleanup_product_variant_idx
ON cart_items(product_id, variant_id);
