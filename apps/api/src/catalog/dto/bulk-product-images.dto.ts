
import { z } from 'zod';

export const bulkProductIdSchema = z.uuid();

const bulkImageSchema = z.strictObject({
  mediaId: z.uuid(),

  variantId: z.uuid().nullable().optional(),

  isFeatured: z.boolean().default(false),

  position: z.number()
    .int()
    .min(0)
    .max(1000000)
    .optional(),
});

export const bulkProductImagesSchema = z
  .strictObject({
    images: z.array(bulkImageSchema)
      .min(1, 'Ajoutez au moins une image.')
      .max(50, 'Maximum 50 images par requête.')
      .superRefine((images, ctx) => {
        const seen = new Set<string>();
        let featuredCount = 0;

        images.forEach((image, index) => {
          const key =
            `${image.mediaId}:${image.variantId ?? 'general'}`;

          if (seen.has(key)) {
            ctx.addIssue({
              code: 'custom',
              path: [index, 'mediaId'],
              message:
                'Cette image est présente plusieurs fois pour la même variation.',
            });
          }

          seen.add(key);

          if (image.isFeatured) {
            featuredCount += 1;
          }
        });

        if (featuredCount > 1) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Une seule image principale est autorisée.',
          });
        }
      }),
  });

export type BulkProductImagesInput =
  z.infer<typeof bulkProductImagesSchema>;
