
import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Le code est obligatoire.')
  .max(100, 'Le code est trop long.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Utilisez des lettres minuscules, chiffres et tirets.',
  );

export const createAttributeSchema = z
  .strictObject({
    name: z.string()
      .trim()
      .min(1, 'Le nom est obligatoire.')
      .max(150),

    code: slugSchema,

    scope: z.enum(['global', 'custom']),

    productId: z.uuid().nullable().optional(),

    description: z.string()
      .trim()
      .max(5000)
      .nullable()
      .optional(),

    position: z.number()
      .int()
      .min(0)
      .default(0),

    isFilterable: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'global' && data.productId) {
      ctx.addIssue({
        code: 'custom',
        path: ['productId'],
        message: 'Un attribut global ne doit pas avoir de produit.',
      });
    }

    if (data.scope === 'custom' && !data.productId) {
      ctx.addIssue({
        code: 'custom',
        path: ['productId'],
        message: 'Un attribut personnalisé nécessite un produit.',
      });
    }

    if (data.scope === 'custom' && data.isFilterable) {
      ctx.addIssue({
        code: 'custom',
        path: ['isFilterable'],
        message: 'Les filtres globaux nécessitent un attribut global.',
      });
    }
  });

export const createAttributeValueSchema =
  z.strictObject({
    attributeId: z.uuid(),

    name: z.string()
      .trim()
      .min(1, 'La valeur est obligatoire.')
      .max(150),

    slug: slugSchema,

    colorHex: z.string()
      .regex(
        /^#[0-9a-fA-F]{6}$/,
        'Couleur hexadécimale invalide.',
      )
      .nullable()
      .optional(),

    position: z.number()
      .int()
      .min(0)
      .default(0),
  });

export type CreateAttributeDto =
  z.infer<typeof createAttributeSchema>;

export type CreateAttributeValueDto =
  z.infer<typeof createAttributeValueSchema>;
