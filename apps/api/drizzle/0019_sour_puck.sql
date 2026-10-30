
CREATE TABLE "media_upload_settings" (
    "id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
    "configuration" jsonb NOT NULL,
    "updated_by" uuid,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "media_upload_settings_singleton_check"
        CHECK ("id" = 1)
);
--> statement-breakpoint

ALTER TABLE "media_upload_settings"
ADD CONSTRAINT "media_upload_settings_updated_by_fk"
FOREIGN KEY ("updated_by")
REFERENCES "public"."admin_users"("id")
ON DELETE SET NULL;
--> statement-breakpoint

INSERT INTO "media_upload_settings" (
    "id",
    "configuration"
)
VALUES (
    1,
    '{
        "images": {
            "enabled": true,
            "maxSizeMb": 5
        },
        "modernImages": {
            "enabled": true,
            "maxSizeMb": 5
        },
        "documents": {
            "enabled": true,
            "maxSizeMb": 20
        },
        "spreadsheets": {
            "enabled": true,
            "maxSizeMb": 20
        },
        "videos": {
            "enabled": false,
            "maxSizeMb": 100
        },
        "archives": {
            "enabled": false,
            "maxSizeMb": 20
        },
        "allowExternalHttp": true,
        "allowExternalHttps": true
    }'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
