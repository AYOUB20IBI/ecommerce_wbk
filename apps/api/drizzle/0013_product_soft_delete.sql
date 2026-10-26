
CREATE TABLE "product_deletion_state" (
  "product_id" uuid PRIMARY KEY NOT NULL,
  "previous_status" varchar(20) NOT NULL,
  "deleted_by" uuid,
  "deleted_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "product_deletion_state_product_fk"
    FOREIGN KEY ("product_id")
    REFERENCES "public"."products"("id")
    ON DELETE RESTRICT,

  CONSTRAINT "product_deletion_state_admin_fk"
    FOREIGN KEY ("deleted_by")
    REFERENCES "public"."admin_users"("id")
    ON DELETE SET NULL,

  CONSTRAINT "product_deletion_state_previous_status_check"
    CHECK (
      "previous_status" IN (
        'draft',
        'published',
        'private',
        'archived'
      )
    )
);

--> statement-breakpoint

CREATE INDEX "product_deletion_state_deleted_at_idx"
ON "public"."product_deletion_state" ("deleted_at");
