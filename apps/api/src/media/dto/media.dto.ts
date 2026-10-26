
import { z } from 'zod';

const externalUrlSchema = z
  .url('URL invalide.')
  .max(2048, 'URL trop longue.')
  .refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();

      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.hash === '' &&
        url.port === '' &&
        host.includes('.') &&
        host !== 'localhost' &&
        !host.endsWith('.localhost') &&
        !host.endsWith('.local') &&
        !host.endsWith('.internal') &&
        !host.includes(':') &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(host)
      );
    } catch {
      return false;
    }
  }, 'Une URL HTTPS publique est requise.');

export const externalMediaSchema = z.strictObject({
  url: externalUrlSchema,

  altText: z.string()
    .trim()
    .max(255)
    .nullable()
    .optional(),
});

export const updateMediaSchema = z.strictObject({
  altText: z.string()
    .trim()
    .max(255)
    .nullable(),
});

export const mediaListSchema = z.strictObject({
  page: z.coerce.number()
    .int()
    .min(1)
    .max(100000)
    .default(1),

  limit: z.coerce.number()
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
