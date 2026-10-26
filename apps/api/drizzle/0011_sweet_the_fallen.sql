CREATE TABLE "taxonomy_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "taxonomy_activity_entity_idx" ON "taxonomy_activity" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "taxonomy_activity_admin_idx" ON "taxonomy_activity" USING btree ("admin_id");