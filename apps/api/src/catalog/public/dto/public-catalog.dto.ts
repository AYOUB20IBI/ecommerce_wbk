
import { z } from 'zod';

const priceSchema = z.string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    'Prix invalide.',
  );

export const publicCatalogQuerySchema = z
  .strictObject({
    page: z.coerce.number()
      .int()
      .min(1)
      .max(100000)
      .default(1),

    limit: z.coerce.number()
      .int()
      .min(1)
      .max(48)
      .default(12),

    search: z.string()
      .trim()
      .max(100)
      .optional(),

    category: z.string()
      .trim()
      .max(255)
      .optional(),

    brand: z.string()
      .trim()
      .max(255)
      .optional(),

    tag: z.string()
      .trim()
      .max(255)
      .optional(),

    attributeId: z.uuid().optional(),
    valueId: z.uuid().optional(),

    minPrice: priceSchema.optional(),
    maxPrice: priceSchema.optional(),

    inStock: z.enum([
      'true',
      'false',
    ]).optional(),

    sortBy: z.enum([
      'newest',
      'oldest',
      'name',
      'price',
    ]).default('newest'),

    sortOrder: z.enum([
      'asc',
      'desc',
    ]).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      Boolean(data.attributeId) !==
      Boolean(data.valueId)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['attributeId'],
        message:
          'attributeId et valueId doivent être fournis ensemble.',
      });
    }

    if (
      data.minPrice !== undefined &&
      data.maxPrice !== undefined &&
      Number(data.minPrice) > Number(data.maxPrice)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxPrice'],
        message:
          'Le prix maximum doit être supérieur au minimum.',
      });
    }
  });

export const publicSlugSchema = z.string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug invalide.',
  );

export const publicTaxonomyQuerySchema =
  z.strictObject({
    page: z.coerce.number()
      .int()
      .min(1)
      .max(100000)
      .default(1),

    limit: z.coerce.number()
      .int()
      .min(1)
      .max(100)
      .default(50),
  });

export type PublicCatalogQuery =
  z.infer<typeof publicCatalogQuerySchema>;

export type PublicTaxonomyQuery =
  z.infer<typeof publicTaxonomyQuerySchema>;
