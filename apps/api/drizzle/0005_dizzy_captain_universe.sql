ALTER TYPE "public"."product_status" ADD VALUE 'private' BEFORE 'archived';--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "variant_regular_price_nonnegative";--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "variant_sale_price_valid";--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "regular_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "products_updated_by_idx" ON "products" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_regular_price_nonnegative" CHECK ("product_variants"."regular_price" IS NULL
        OR "product_variants"."regular_price" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_sale_price_valid" CHECK ("product_variants"."sale_price" IS NULL
        OR (
          "product_variants"."regular_price" IS NOT NULL
          AND "product_variants"."sale_price" >= 0
          AND "product_variants"."sale_price" <= "product_variants"."regular_price"
        ));