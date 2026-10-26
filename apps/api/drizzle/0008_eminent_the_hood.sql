CREATE TYPE "public"."media_source" AS ENUM('upload', 'external');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_storage_provider" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "media_source" NOT NULL,
	"storage_provider" "media_storage_provider",
	"storage_key" varchar(500),
	"external_url" text,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"file_size" bigint,
	"width" integer,
	"height" integer,
	"alt_text" varchar(255),
	"status" "media_status" DEFAULT 'ready' NOT NULL,
	"uploaded_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_source_consistency" CHECK ((
        "media"."source_type" = 'upload'
        AND "media"."storage_provider" IS NOT NULL
        AND "media"."storage_key" IS NOT NULL
        AND "media"."external_url" IS NULL
        AND "media"."mime_type" = 'image/webp'
        AND "media"."file_size" > 0
        AND "media"."width" > 0
        AND "media"."height" > 0
      ) OR (
        "media"."source_type" = 'external'
        AND "media"."storage_provider" IS NULL
        AND "media"."storage_key" IS NULL
        AND "media"."external_url" IS NOT NULL
        AND "media"."mime_type" IS NULL
        AND "media"."file_size" IS NULL
        AND "media"."width" IS NULL
        AND "media"."height" IS NULL
      )),
	CONSTRAINT "media_external_https" CHECK ("media"."external_url" IS NULL
          OR "media"."external_url" LIKE 'https://%')
);
--> statement-breakpoint
CREATE TABLE "media_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"changes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"variant_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_position_nonnegative" CHECK ("product_images"."position" >= 0),
	CONSTRAINT "product_images_featured_not_variant" CHECK ("product_images"."is_featured" = false
          OR "product_images"."variant_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_activity" ADD CONSTRAINT "media_activity_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_activity" ADD CONSTRAINT "media_activity_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_provider_key_unique" ON "media" USING btree ("storage_provider","storage_key");--> statement-breakpoint
CREATE INDEX "media_status_created_idx" ON "media" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "media_activity_media_created_idx" ON "media_activity" USING btree ("media_id","created_at");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_media_idx" ON "product_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "product_images_variant_idx" ON "product_images" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_one_featured" ON "product_images" USING btree ("product_id") WHERE "product_images"."is_featured" = true;