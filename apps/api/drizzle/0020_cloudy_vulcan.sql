ALTER TABLE "media" DROP CONSTRAINT "media_source_consistency";--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_external_https";--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_consistency" CHECK ((
        (
          "media"."source_type" = 'upload'
          AND "media"."storage_provider" IS NOT NULL
          AND "media"."storage_key" IS NOT NULL
          AND length("media"."storage_key") > 0
          AND "media"."external_url" IS NULL
          AND "media"."mime_type" IS NOT NULL
          AND length("media"."mime_type") > 0
          AND "media"."file_size" IS NOT NULL
          AND "media"."file_size" > 0
          AND (
            (
              "media"."width" IS NULL
              AND "media"."height" IS NULL
            )
            OR
            (
              "media"."width" > 0
              AND "media"."height" > 0
            )
          )
        )
        OR
        (
          "media"."source_type" = 'external'
          AND "media"."storage_provider" IS NULL
          AND "media"."storage_key" IS NULL
          AND "media"."external_url" IS NOT NULL
          AND length("media"."external_url") > 0
          AND "media"."mime_type" IS NULL
          AND "media"."file_size" IS NULL
          AND "media"."width" IS NULL
          AND "media"."height" IS NULL
        )
      ));--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_external_https" CHECK ((
        "media"."external_url" IS NULL
        OR "media"."external_url" LIKE 'https://%'
        OR "media"."external_url" LIKE 'http://%'
      ));