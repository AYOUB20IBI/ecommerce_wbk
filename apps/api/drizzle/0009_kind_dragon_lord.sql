CREATE TYPE "public"."media_deletion_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."media_status" ADD VALUE IF NOT EXISTS 'deleting' BEFORE 'deleted'--> statement-breakpoint
CREATE TABLE "media_deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"provider" "media_storage_provider" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"status" "media_deletion_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"lock_token" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "media_deletion_jobs_attempts_valid" CHECK ("media_deletion_jobs"."attempts" >= 0
        AND "media_deletion_jobs"."max_attempts" > 0),
	CONSTRAINT "media_deletion_jobs_processing_lease" CHECK ("media_deletion_jobs"."status" <> 'processing'
        OR (
          "media_deletion_jobs"."lock_token" IS NOT NULL
          AND "media_deletion_jobs"."locked_until" IS NOT NULL
        ))
);
--> statement-breakpoint
ALTER TABLE "media_deletion_jobs" ADD CONSTRAINT "media_deletion_jobs_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_deletion_jobs_media_unique" ON "media_deletion_jobs" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "media_deletion_jobs_pending_idx" ON "media_deletion_jobs" USING btree ("next_attempt_at") WHERE "media_deletion_jobs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "media_deletion_jobs_lease_idx" ON "media_deletion_jobs" USING btree ("locked_until") WHERE "media_deletion_jobs"."status" = 'processing';