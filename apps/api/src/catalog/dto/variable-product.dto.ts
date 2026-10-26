
import { z } from 'zod';

export const variableProductIdSchema = z.uuid();

const moneySchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    'Prix invalide. Exemple : 149.00',
  );

const codeSchema = (max: number) =>
  z.string()
    .trim()
    .min(1)
    .max(max)
    .nullable();

const statusSchema = z.enum([
  'draft',
  'published',
  'private',
  'archived',
]);

export const variantOptionSchema = z.strictObject({
  attributeId: z.uuid(),
  valueId: z.uuid(),
});

const optionsSchema = z.array(variantOptionSchema)
  .min(1, 'Une option est obligatoire.')
  .max(30)
  .superRefine((options, ctx) => {
    const ids = options.map(
      (option) => option.attributeId,
    );

    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Attribut dupliqué.',
      });
    }
  });

function cents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');

  return BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));
}

function validatePrices(
  regular: string | null | undefined,
  sale: string | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (regular == null || sale == null) return;

  if (cents(sale) > cents(regular)) {
    ctx.addIssue({
      code: 'custom',
      path: ['salePrice'],
      message:
        'Le prix promotionnel ne peut pas dépasser le prix normal.',
    });
  }
}

export const createVariantSchema = z.strictObject({
  sku: codeSchema(100).optional(),
  ean: codeSchema(32).optional(),

  regularPrice: moneySchema.nullable(),

  salePrice: moneySchema
    .nullable()
    .optional(),

  stockQuantity: z.number()
    .int()
    .min(0)
    .max(2147483647),

  manageStock: z.boolean().default(true),

  isActive: z.boolean().default(true),

  options: optionsSchema,
}).superRefine((data, ctx) => {
  validatePrices(
    data.regularPrice,
    data.salePrice,
    ctx,
  );
});

export const updateVariantSchema = z.strictObject({
  sku: codeSchema(100).optional(),
  ean: codeSchema(32).optional(),

  regularPrice: moneySchema
    .nullable()
    .optional(),

  salePrice: moneySchema
    .nullable()
    .optional(),

  stockQuantity: z.number()
    .int()
    .min(0)
    .max(2147483647)
    .optional(),

  manageStock: z.boolean().optional(),
  isActive: z.boolean().optional(),

  options: optionsSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'Aucune modification fournie.',
);

export const updateVariableProductSchema = z.strictObject({
  name: z.string()
    .trim()
    .min(1)
    .max(255)
    .optional(),

  slug: z.string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(255)
    .optional(),

  status: statusSchema.optional(),

  description: z.string()
    .max(100000)
    .nullable()
    .optional(),

  shortDescription: z.string()
    .max(5000)
    .nullable()
    .optional(),

  seoTitle: z.string()
    .trim()
    .max(255)
    .nullable()
    .optional(),

  seoDescription: z.string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),

  isFeatured: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'Aucune modification fournie.',
);

export type CreateVariantInput =
  z.infer<typeof createVariantSchema>;

export type UpdateVariantInput =
  z.infer<typeof updateVariantSchema>;

export type UpdateVariableProductInput =
  z.infer<typeof updateVariableProductSchema>;
