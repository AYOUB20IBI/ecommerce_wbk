CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('simple', 'variable');--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(100),
	"ean" varchar(32),
	"regular_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2),
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"manage_stock" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_regular_price_nonnegative" CHECK ("product_variants"."regular_price" >= 0),
	CONSTRAINT "variant_sale_price_valid" CHECK ("product_variants"."sale_price" IS NULL OR (
        "product_variants"."sale_price" >= 0
        AND "product_variants"."sale_price" <= "product_variants"."regular_price"
      )),
	CONSTRAINT "variant_stock_nonnegative" CHECK ("product_variants"."stock_quantity" >= 0),
	CONSTRAINT "variant_position_nonnegative" CHECK ("product_variants"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "product_type" DEFAULT 'simple' NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"short_description" text,
	"description" text,
	"seo_title" varchar(255),
	"seo_description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_ean_unique" ON "product_variants" USING btree ("ean");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_one_default" ON "product_variants" USING btree ("product_id") WHERE "product_variants"."is_default" = true;--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("type");