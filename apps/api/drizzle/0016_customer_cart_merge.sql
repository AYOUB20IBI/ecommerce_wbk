
-- STEP 15.1.3 - CUSTOMER CART

-- Ensure that the customer table exists.
DO $$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION
      'Table public.customers is required.';
  END IF;
END $$;

-- Cart owner must reference a real customer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'carts'::regclass
      AND conname = 'carts_customer_fk'
  ) THEN
    ALTER TABLE carts
      ADD CONSTRAINT carts_customer_fk
      FOREIGN KEY (customer_id)
      REFERENCES customers(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS
  carts_customer_status_idx
ON carts(customer_id, status)
WHERE customer_id IS NOT NULL;
