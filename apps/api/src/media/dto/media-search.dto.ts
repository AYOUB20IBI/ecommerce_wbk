
import { z } from 'zod';

export const mediaSearchSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(24),

  search: z.string().trim().max(150).default(''),

  type: z.enum([
    'all',
    'image',
    'document',
  ]).default('all'),
});

export type MediaSearchInput = z.infer<
  typeof mediaSearchSchema
>;
