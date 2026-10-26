
import { z } from 'zod';

export const productTaxonomyIdSchema = z.uuid();

const uniqueIds = z
  .array(z.uuid())
  .max(100, 'Maximum 100 éléments autorisés.')
  .refine(
    (items) => new Set(items).size === items.length,
    'Les identifiants dupliqués sont interdits.',
  );

export const updateProductTaxonomiesSchema = z
  .strictObject({
    // null = remove brand
    // undefined = keep existing brand
    brandId: z.uuid().nullable().optional(),

    // [] = remove all categories
    categoryIds: uniqueIds.optional(),

    // [] = remove all tags
    tagIds: uniqueIds.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'Aucune modification fournie.',
  );

export type UpdateProductTaxonomiesInput =
  z.infer<typeof updateProductTaxonomiesSchema>;
