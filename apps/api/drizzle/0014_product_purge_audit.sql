
CREATE TABLE "product_purge_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL,
  "product_name" text NOT NULL,
  "product_slug" text NOT NULL,
  "product_type" varchar(30) NOT NULL,
  "purged_by" uuid NOT NULL,
  "purged_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);

--> statement-breakpoint

CREATE INDEX "product_purge_audit_product_id_idx"
ON "product_purge_audit" ("product_id");

--> statement-breakpoint

CREATE INDEX "product_purge_audit_purged_at_idx"
ON "product_purge_audit" ("purged_at");
