-- Custom SQL migration file, put your code below! --

CREATE TABLE IF NOT EXISTS "product_brands" (
  "product_id" uuid PRIMARY KEY NOT NULL,
  "brand_id" uuid NOT NULL,

  CONSTRAINT "product_brands_product_fk"
    FOREIGN KEY ("product_id")
    REFERENCES "public"."products"("id")
    ON DELETE CASCADE,

  CONSTRAINT "product_brands_brand_fk"
    FOREIGN KEY ("brand_id")
    REFERENCES "public"."brands"("id")
    ON DELETE RESTRICT
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_brands_brand_idx"
ON "public"."product_brands" ("brand_id");
