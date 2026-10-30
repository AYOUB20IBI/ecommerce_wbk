-- CREATE TABLE "product_deletion_state" (
-- 	"product_id" uuid PRIMARY KEY NOT NULL,
-- 	"previous_status" varchar(20) NOT NULL,
-- 	"deleted_by" uuid,
-- 	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
-- 	CONSTRAINT "product_deletion_state_previous_status_check" CHECK ("product_deletion_state"."previous_status" IN (
--         'draft',
--         'published',
--         'private',
--         'archived'
--       ))
-- );
-- --> statement-breakpoint
-- CREATE TABLE "product_purge_audit" (
-- 	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
-- 	"product_id" uuid NOT NULL,
-- 	"product_name" text NOT NULL,
-- 	"product_slug" text NOT NULL,
-- 	"product_type" varchar(30) NOT NULL,
-- 	"purged_by" uuid NOT NULL,
-- 	"purged_at" timestamp with time zone DEFAULT now() NOT NULL,
-- 	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
-- );
-- --> statement-breakpoint
-- ALTER TABLE "product_deletion_state" ADD CONSTRAINT "product_deletion_state_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "product_deletion_state" ADD CONSTRAINT "product_deletion_state_deleted_by_admin_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- CREATE INDEX "product_deletion_state_deleted_at_idx" ON "product_deletion_state" USING btree ("deleted_at");--> statement-breakpoint
-- CREATE INDEX "product_purge_audit_product_id_idx" ON "product_purge_audit" USING btree ("product_id");--> statement-breakpoint
-- CREATE INDEX "product_purge_audit_purged_at_idx" ON "product_purge_audit" USING btree ("purged_at");


-- Migration 0018
-- Product purge audit support.
--
-- product_deletion_state is already created
-- by migration 0013_product_soft_delete.sql.
--
-- This migration must not recreate that table.

CREATE TABLE IF NOT EXISTS "public"."product_purge_audit" (
    "id" uuid
        PRIMARY KEY
        DEFAULT gen_random_uuid()
        NOT NULL,

    "product_id" uuid NOT NULL,

    "product_name" text NOT NULL,

    "product_slug" text NOT NULL,

    "product_type" varchar(30) NOT NULL,

    "purged_by" uuid NOT NULL,

    "purged_at" timestamp with time zone
        DEFAULT now()
        NOT NULL,

    "metadata" jsonb
        DEFAULT '{}'::jsonb
        NOT NULL
);

--> statement-breakpoint

-- Ensure metadata is available if an older
-- version of this table already exists.

ALTER TABLE "public"."product_purge_audit"
ADD COLUMN IF NOT EXISTS "metadata"
jsonb DEFAULT '{}'::jsonb NOT NULL;

--> statement-breakpoint

-- Product deletion state index.
-- The table itself was created by migration 0013.

CREATE INDEX IF NOT EXISTS
"product_deletion_state_deleted_at_idx"
ON "public"."product_deletion_state"
USING btree ("deleted_at");

--> statement-breakpoint

-- Purge audit indexes.

CREATE INDEX IF NOT EXISTS
"product_purge_audit_product_id_idx"
ON "public"."product_purge_audit"
USING btree ("product_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
"product_purge_audit_purged_at_idx"
ON "public"."product_purge_audit"
USING btree ("purged_at");
