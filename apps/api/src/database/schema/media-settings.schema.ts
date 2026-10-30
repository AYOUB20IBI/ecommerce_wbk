import {
  jsonb,
  pgTable,
  smallint,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const mediaUploadSettings = pgTable(
  "media_upload_settings",
  {
    id: smallint("id").primaryKey().default(1),

    configuration: jsonb("configuration").notNull(),

    updatedBy: uuid("updated_by"),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
);