
import { z } from "zod";

const externalUrlSchema = z
  .url("Invalid URL.")
  .max(2048, "URL is too long.")
  .refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();

      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username !== "" ||
        url.password !== "" ||
        url.hash !== "" ||
        url.port !== ""
      ) {
        return false;
      }

      if (
        !host.includes(".") ||
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host.endsWith(".test") ||
        host.endsWith(".invalid") ||
        host.endsWith(".example") ||
        host.endsWith(".onion") ||
        host.endsWith(".arpa") ||
        host.includes(":")
      ) {
        return false;
      }

      // Do not accept IP literals as external media hosts.
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        return false;
      }

      // Reject numeric and single-label host variations.
      if (
        host.split(".").some(
          (label) =>
            label.length === 0 ||
            !/^[a-z0-9-]+$/.test(label) ||
            label.startsWith("-") ||
            label.endsWith("-"),
        )
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, "A valid public HTTP or HTTPS URL is required.");

export const externalMediaSchema = z.strictObject({
  url: externalUrlSchema,

  altText: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional(),
});

export const updateMediaSchema = z.strictObject({
  altText: z.string().trim().max(255).nullable(),
});

export const mediaListSchema = z.strictObject({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export const mediaIdSchema = z.uuid();

export type ExternalMediaInput =
  z.infer<typeof externalMediaSchema>;

export type UpdateMediaInput =
  z.infer<typeof updateMediaSchema>;
