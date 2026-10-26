CREATE TYPE "public"."attribute_scope" AS ENUM('global', 'custom');--> statement-breakpoint
CREATE TABLE "attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"color_hex" varchar(7),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_values_position_nonnegative" CHECK ("attribute_values"."position" >= 0),
	CONSTRAINT "attribute_values_color_hex_valid" CHECK ("attribute_values"."color_hex" IS NULL OR
        "attribute_values"."color_hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(100) NOT NULL,
	"scope" "attribute_scope" DEFAULT 'global' NOT NULL,
	"product_id" uuid,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_filterable" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attributes_scope_product_valid" CHECK ((
        "attributes"."scope" = 'global'
        AND "attributes"."product_id" IS NULL
      ) OR (
        "attributes"."scope" = 'custom'
        AND "attributes"."product_id" IS NOT NULL
      )),
	CONSTRAINT "attributes_position_nonnegative" CHECK ("attributes"."position" >= 0),
	CONSTRAINT "attributes_code_not_blank" CHECK (length(btrim("attributes"."code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "product_attribute_values_product_id_attribute_id_value_id_pk" PRIMARY KEY("product_id","attribute_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"used_for_variations" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_attributes_product_id_attribute_id_pk" PRIMARY KEY("product_id","attribute_id"),
	CONSTRAINT "product_attributes_position_nonnegative" CHECK ("product_attributes"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "variant_attribute_values" (
	"variant_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "variant_attribute_values_variant_id_attribute_id_pk" PRIMARY KEY("variant_id","attribute_id")
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "combination_key" varchar(64);--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_value_id_attribute_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."attribute_values"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_value_id_attribute_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."attribute_values"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_values_slug_unique" ON "attribute_values" USING btree ("attribute_id","slug");--> statement-breakpoint
CREATE INDEX "attribute_values_attribute_idx" ON "attribute_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_global_code_unique" ON "attributes" USING btree ("code") WHERE "attributes"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_custom_code_unique" ON "attributes" USING btree ("product_id","code") WHERE "attributes"."scope" = 'custom';--> statement-breakpoint
CREATE INDEX "attributes_product_idx" ON "attributes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_value_idx" ON "product_attribute_values" USING btree ("value_id");--> statement-breakpoint
CREATE INDEX "product_attributes_attribute_idx" ON "product_attributes" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "variant_attribute_values_value_idx" ON "variant_attribute_values" USING btree ("value_id");--> statement-breakpoint
CREATE INDEX "variant_attribute_values_attr_value_idx" ON "variant_attribute_values" USING btree ("attribute_id","value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_combination_unique" ON "product_variants" USING btree ("product_id","combination_key") WHERE "product_variants"."combination_key" IS NOT NULL;