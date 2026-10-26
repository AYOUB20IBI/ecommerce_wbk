
import { z } from 'zod';

export const imageUuidSchema = z.uuid();

export const addProductImageSchema = z.strictObject({
  mediaId: z.uuid(),

  variantId: z.uuid().nullable().optional(),

  isFeatured: z.boolean().default(false),

  position: z.number()
    .int()
    .min(0)
    .max(1000000)
    .optional(),
});

export const updateProductImageSchema = z
  .strictObject({
    variantId: z.uuid().nullable().optional(),

    isFeatured: z.boolean().optional(),

    position: z.number()
      .int()
      .min(0)
      .max(1000000)
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'Aucune modification fournie.',
  );

export const reorderProductImagesSchema =
  z.strictObject({
    imageIds: z.array(z.uuid())
      .max(1000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Les images dupliquées sont interdites.',
      ),
  });

export type AddProductImageInput =
  z.infer<typeof addProductImageSchema>;

export type UpdateProductImageInput =
  z.infer<typeof updateProductImageSchema>;

export type ReorderProductImagesInput =
  z.infer<typeof reorderProductImagesSchema>;
