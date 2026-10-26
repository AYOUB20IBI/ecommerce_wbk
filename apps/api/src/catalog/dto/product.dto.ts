
// import { z } from 'zod';

// // ========================================
// // COMMON SCHEMAS
// // ========================================

// export const productIdSchema = z.uuid();

// const nameSchema = z.string()
//   .trim()
//   .min(1, 'Le nom du produit est obligatoire.')
//   .max(255, 'Le nom est trop long.');

// const slugSchema = z.string()
//   .trim()
//   .toLowerCase()
//   .min(1, 'Le slug est obligatoire.')
//   .max(255)
//   .regex(
//     /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
//     'Le slug contient des caractères invalides.',
//   );

// const priceSchema = z.string()
//   .regex(
//     /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
//     'Prix invalide. Exemple : 99.00',
//   )
//   .nullable();

// const optionalCode = (max: number) =>
//   z.string()
//     .trim()
//     .max(max)
//     .nullable()
//     .optional()
//     .transform((value) => value || null);

// const statusSchema = z.enum([
//   'draft',
//   'published',
//   'private',
//   'archived',
// ]);

// const productFields = {
//   name: nameSchema,
//   slug: slugSchema,

//   status: statusSchema.default('draft'),

//   shortDescription: z.string()
//     .max(5000)
//     .nullable()
//     .optional(),

//   description: z.string()
//     .max(100000)
//     .nullable()
//     .optional(),

//   seoTitle: z.string()
//     .trim()
//     .max(255)
//     .nullable()
//     .optional(),

//   seoDescription: z.string()
//     .trim()
//     .max(2000)
//     .nullable()
//     .optional(),

//   isFeatured: z.boolean().default(false),
// };

// const variantFields = {
//   sku: optionalCode(100),
//   ean: optionalCode(32),

//   regularPrice: priceSchema,

//   salePrice: priceSchema.optional(),

//   stockQuantity: z.number()
//     .int('Le stock doit être un entier.')
//     .min(0, 'Le stock ne peut pas être négatif.')
//     .max(2147483647),

//   manageStock: z.boolean().default(true),

//   isActive: z.boolean().default(true),
// };

// // ========================================
// // VALIDATION HELPERS
// // ========================================

// function isSalePriceValid(
//   regular: string | null,
//   sale: string | null | undefined,
// ): boolean {
//   if (sale == null) return true;
//   if (regular == null) return false;

//   // Prices have max 2 decimal places and 10 integer
//   // digits. Comparing integer cents avoids float issues.
//   return toCents(sale) <= toCents(regular);
// }

// function toCents(value: string): bigint {
//   const [whole, fraction = ''] = value.split('.');

//   return BigInt(whole) * 100n +
//     BigInt(fraction.padEnd(2, '0'));
// }

// function checkPrice(
//   regular: string | null,
//   sale: string | null | undefined,
//   ctx: z.RefinementCtx,
//   path: (string | number)[],
// ) {
//   if (!isSalePriceValid(regular, sale)) {
//     ctx.addIssue({
//       code: 'custom',
//       path,
//       message:
//         'Le prix promotionnel doit être inférieur ou égal au prix normal.',
//     });
//   }
// }

// // ========================================
// // SIMPLE PRODUCT CREATE
// // ========================================

// export const simpleVariantSchema = z.strictObject(
//   variantFields,
// );

// export const createSimpleProductSchema = z
//   .strictObject({
//     ...productFields,
//     type: z.literal('simple'),
//     variant: simpleVariantSchema,
//   })
//   .superRefine((data, ctx) => {
//     checkPrice(
//       data.variant.regularPrice,
//       data.variant.salePrice,
//       ctx,
//       ['variant', 'salePrice'],
//     );

//     if (
//       data.status === 'published' &&
//       data.variant.regularPrice === null
//     ) {
//       ctx.addIssue({
//         code: 'custom',
//         path: ['variant', 'regularPrice'],
//         message:
//           'Le prix est obligatoire pour publier le produit.',
//       });
//     }

//     if (
//       data.status === 'published' &&
//       !data.variant.isActive
//     ) {
//       ctx.addIssue({
//         code: 'custom',
//         path: ['variant', 'isActive'],
//         message:
//           'La variation doit être active pour publier.',
//       });
//     }
//   });

// // ========================================
// // VARIABLE ATTRIBUTES
// // ========================================

// const variantOptionSchema = z.strictObject({
//   attributeId: z.uuid(),
//   valueId: z.uuid(),
// });

// const variableAttributeSchema = z.strictObject({
//   attributeId: z.uuid(),

//   valueIds: z.array(z.uuid())
//     .min(1, 'Une valeur est obligatoire.')
//     .max(100),

//   visible: z.boolean().default(true),

//   usedForVariations: z.literal(true),
// });

// // ========================================
// // VARIABLE VARIANTS
// // ========================================

// const variableVariantSchema = z.strictObject({
//   ...variantFields,

//   isDefault: z.boolean().default(false),

//   options: z.array(variantOptionSchema)
//     .min(1)
//     .max(30),
// });

// // ========================================
// // VARIABLE PRODUCT CREATE
// // ========================================

// export const createVariableProductSchema = z
//   .strictObject({
//     ...productFields,

//     type: z.literal('variable'),

//     attributes: z.array(variableAttributeSchema)
//       .min(1, 'Un attribut est obligatoire.')
//       .max(30),

//     variants: z.array(variableVariantSchema)
//       .min(1, 'Une variation est obligatoire.')
//       .max(200),
//   })
//   .superRefine((data, ctx) => {
//     const attributeIds = data.attributes.map(
//       (attribute) => attribute.attributeId,
//     );

//     if (
//       new Set(attributeIds).size !== attributeIds.length
//     ) {
//       ctx.addIssue({
//         code: 'custom',
//         path: ['attributes'],
//         message: 'Attribut dupliqué.',
//       });
//     }

//     for (
//       const [index, attribute] of
//       data.attributes.entries()
//     ) {
//       if (
//         new Set(attribute.valueIds).size !==
//         attribute.valueIds.length
//       ) {
//         ctx.addIssue({
//           code: 'custom',
//           path: ['attributes', index, 'valueIds'],
//           message: 'Valeurs dupliquées.',
//         });
//       }
//     }

//     const defaultCount = data.variants.filter(
//       (variant) => variant.isDefault,
//     ).length;

//     if (defaultCount !== 1) {
//       ctx.addIssue({
//         code: 'custom',
//         path: ['variants'],
//         message:
//           'Une seule variation par défaut est obligatoire.',
//       });
//     }

//     const allowedAttributes = new Map(
//       data.attributes.map((attribute) => [
//         attribute.attributeId,
//         new Set(attribute.valueIds),
//       ]),
//     );

//     data.variants.forEach((variant, i) => {
//       const ids = variant.options.map(
//         (option) => option.attributeId,
//       );

//       if (
//         ids.length !== allowedAttributes.size ||
//         new Set(ids).size !== ids.length ||
//         ids.some((id) => !allowedAttributes.has(id))
//       ) {
//         ctx.addIssue({
//           code: 'custom',
//           path: ['variants', i, 'options'],
//           message:
//             'Chaque variation doit avoir une valeur pour chaque attribut.',
//         });
//       }

//       variant.options.forEach((option, j) => {
//         const allowed = allowedAttributes.get(
//           option.attributeId,
//         );

//         if (
//           allowed &&
//           !allowed.has(option.valueId)
//         ) {
//           ctx.addIssue({
//             code: 'custom',
//             path: ['variants', i, 'options', j],
//             message:
//               'Valeur non autorisée pour cet attribut.',
//           });
//         }
//       });

//       checkPrice(
//         variant.regularPrice,
//         variant.salePrice,
//         ctx,
//         ['variants', i, 'salePrice'],
//       );
//     });

//     if (data.status === 'published') {
//       const hasPurchasableVariant =
//         data.variants.some(
//           (variant) =>
//             variant.isActive &&
//             variant.regularPrice !== null,
//         );

//       if (!hasPurchasableVariant) {
//         ctx.addIssue({
//           code: 'custom',
//           path: ['variants'],
//           message:
//             'Au moins une variation active avec prix est obligatoire.',
//         });
//       }
//     }

//     // All draft/private/archived variants may be
//     // incomplete, but no duplicate combinations.
//     const keys = data.variants.map((variant) =>
//       variant.options
//         .map(
//           (o) => `${o.attributeId}:${o.valueId}`,
//         )
//         .sort()
//         .join('|'),
//     );

//     if (new Set(keys).size !== keys.length) {
//       ctx.addIssue({
//         code: 'custom',
//         path: ['variants'],
//         message:
//           'Deux variations ont la même combinaison.',
//       });
//     }
//   });

// // ========================================
// // CREATE SIMPLE OR VARIABLE
// // ========================================

// export const createProductSchema = z.union([
//   createSimpleProductSchema,
//   createVariableProductSchema,
// ]);

// // ========================================
// // PATCH SIMPLE PRODUCT
// // ========================================

// export const updateProductSchema = z
//   .strictObject({
//     name: nameSchema.optional(),
//     slug: slugSchema.optional(),

//     status: statusSchema.optional(),

//     shortDescription: z.string()
//       .max(5000)
//       .nullable()
//       .optional(),

//     description: z.string()
//       .max(100000)
//       .nullable()
//       .optional(),

//     seoTitle: z.string()
//       .trim()
//       .max(255)
//       .nullable()
//       .optional(),

//     seoDescription: z.string()
//       .trim()
//       .max(2000)
//       .nullable()
//       .optional(),

//     isFeatured: z.boolean().optional(),

//     variant: simpleVariantSchema
//       .partial()
//       .optional(),
//   })
//   .refine(
//     (value) => Object.keys(value).length > 0,
//     'Aucune modification fournie.',
//   );

// // ========================================
// // LIST / FILTER
// // ========================================

// export const productListSchema = z.strictObject({
//   page: z.coerce.number()
//     .int()
//     .min(1)
//     .max(100000)
//     .default(1),

//   limit: z.coerce.number()
//     .int()
//     .min(1)
//     .max(100)
//     .default(20),

//   status: statusSchema.optional(),

//   type: z.enum([
//     'simple',
//     'variable',
//   ]).optional(),

//   search: z.string()
//     .trim()
//     .max(100)
//     .optional(),
// });

// // ========================================
// // TYPES
// // ========================================

// export type CreateSimpleProductInput =
//   z.infer<typeof createSimpleProductSchema>;

// export type CreateVariableProductInput =
//   z.infer<typeof createVariableProductSchema>;

// export type CreateProductInput =
//   z.infer<typeof createProductSchema>;

// export type UpdateProductInput =
//   z.infer<typeof updateProductSchema>;

// export type ProductListInput =
//   z.infer<typeof productListSchema>;

import { z } from 'zod';

// ========================================
// COMMON SCHEMAS
// ========================================

export const productIdSchema = z.uuid();

const nameSchema = z.string()
  .trim()
  .min(1, 'Le nom du produit est obligatoire.')
  .max(255, 'Le nom est trop long.');

const slugSchema = z.string()
  .trim()
  .toLowerCase()
  .min(1, 'Le slug est obligatoire.')
  .max(255)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Le slug contient des caractères invalides.',
  );

const priceSchema = z.string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
    'Prix invalide. Exemple : 99.00',
  )
  .nullable();

const optionalCode = (max: number) =>
  z.string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

const statusSchema = z.enum([
  'draft',
  'published',
  'private',
  'archived',
]);

const productFields = {
  name: nameSchema,
  slug: slugSchema,

  status: statusSchema.default('draft'),

  shortDescription: z.string()
    .max(5000)
    .nullable()
    .optional(),

  description: z.string()
    .max(100000)
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

  isFeatured: z.boolean().default(false),
};

const variantFields = {
  sku: optionalCode(100),
  ean: optionalCode(32),

  regularPrice: priceSchema,
  salePrice: priceSchema.optional(),

  stockQuantity: z.number()
    .int('Le stock doit être un entier.')
    .min(0, 'Le stock ne peut pas être négatif.')
    .max(2147483647),

  manageStock: z.boolean().default(true),
  isActive: z.boolean().default(true),
};

// ========================================
// VALIDATION HELPERS
// ========================================

function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');

  return BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));
}

function isSalePriceValid(
  regular: string | null,
  sale: string | null | undefined,
): boolean {
  if (sale == null) return true;
  if (regular == null) return false;

  return toCents(sale) <= toCents(regular);
}

function checkPrice(
  regular: string | null,
  sale: string | null | undefined,
  ctx: z.RefinementCtx,
  path: (string | number)[],
) {
  if (!isSalePriceValid(regular, sale)) {
    ctx.addIssue({
      code: 'custom',
      path,
      message:
        'Le prix promotionnel doit être inférieur ou égal au prix normal.',
    });
  }
}

// ========================================
// SIMPLE PRODUCT CREATE
// ========================================

export const simpleVariantSchema =
  z.strictObject(variantFields);

export const createSimpleProductSchema = z
  .strictObject({
    ...productFields,
    type: z.literal('simple'),
    variant: simpleVariantSchema,
  })
  .superRefine((data, ctx) => {
    checkPrice(
      data.variant.regularPrice,
      data.variant.salePrice,
      ctx,
      ['variant', 'salePrice'],
    );

    if (
      data.status === 'published' &&
      data.variant.regularPrice === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['variant', 'regularPrice'],
        message:
          'Le prix est obligatoire pour publier le produit.',
      });
    }

    if (
      data.status === 'published' &&
      !data.variant.isActive
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['variant', 'isActive'],
        message:
          'La variation doit être active pour publier.',
      });
    }
  });

// ========================================
// VARIABLE ATTRIBUTES
// ========================================

const variantOptionSchema = z.strictObject({
  attributeId: z.uuid(),
  valueId: z.uuid(),
});

const variableAttributeSchema = z.strictObject({
  attributeId: z.uuid(),

  valueIds: z.array(z.uuid())
    .min(1, 'Une valeur est obligatoire.')
    .max(100),

  visible: z.boolean().default(true),
  usedForVariations: z.literal(true),
});

// ========================================
// VARIABLE VARIANTS
// ========================================

const variableVariantSchema = z.strictObject({
  ...variantFields,

  isDefault: z.boolean().default(false),

  options: z.array(variantOptionSchema)
    .min(1)
    .max(30),
});

// ========================================
// VARIABLE PRODUCT CREATE
// ========================================

export const createVariableProductSchema = z
  .strictObject({
    ...productFields,

    type: z.literal('variable'),

    attributes: z.array(variableAttributeSchema)
      .min(1, 'Un attribut est obligatoire.')
      .max(30),

    variants: z.array(variableVariantSchema)
      .min(1, 'Une variation est obligatoire.')
      .max(200),
  })
  .superRefine((data, ctx) => {
    const attributeIds = data.attributes.map(
      (attribute) => attribute.attributeId,
    );

    if (
      new Set(attributeIds).size !== attributeIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['attributes'],
        message: 'Attribut dupliqué.',
      });
    }

    for (
      const [index, attribute] of
      data.attributes.entries()
    ) {
      if (
        new Set(attribute.valueIds).size !==
        attribute.valueIds.length
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['attributes', index, 'valueIds'],
          message: 'Valeurs dupliquées.',
        });
      }
    }

    const defaultCount = data.variants.filter(
      (variant) => variant.isDefault,
    ).length;

    if (defaultCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message:
          'Une seule variation par défaut est obligatoire.',
      });
    }

    const allowedAttributes = new Map(
      data.attributes.map((attribute) => [
        attribute.attributeId,
        new Set(attribute.valueIds),
      ]),
    );

    data.variants.forEach((variant, i) => {
      const ids = variant.options.map(
        (option) => option.attributeId,
      );

      if (
        ids.length !== allowedAttributes.size ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !allowedAttributes.has(id))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants', i, 'options'],
          message:
            'Chaque variation doit avoir une valeur pour chaque attribut.',
        });
      }

      variant.options.forEach((option, j) => {
        const allowed = allowedAttributes.get(
          option.attributeId,
        );

        if (
          allowed &&
          !allowed.has(option.valueId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['variants', i, 'options', j],
            message:
              'Valeur non autorisée pour cet attribut.',
          });
        }
      });

      checkPrice(
        variant.regularPrice,
        variant.salePrice,
        ctx,
        ['variants', i, 'salePrice'],
      );
    });

    if (data.status === 'published') {
      const hasPurchasableVariant =
        data.variants.some(
          (variant) =>
            variant.isActive &&
            variant.regularPrice !== null,
        );

      if (!hasPurchasableVariant) {
        ctx.addIssue({
          code: 'custom',
          path: ['variants'],
          message:
            'Au moins une variation active avec prix est obligatoire.',
        });
      }
    }

    const keys = data.variants.map((variant) =>
      variant.options
        .map(
          (option) =>
            `${option.attributeId}:${option.valueId}`,
        )
        .sort()
        .join('|'),
    );

    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message:
          'Deux variations ont la même combinaison.',
      });
    }
  });

// ========================================
// CREATE SIMPLE OR VARIABLE
// ========================================

export const createProductSchema = z.union([
  createSimpleProductSchema,
  createVariableProductSchema,
]);

// ========================================
// PATCH SIMPLE PRODUCT
// ========================================

export const updateProductSchema = z
  .strictObject({
    name: nameSchema.optional(),
    slug: slugSchema.optional(),
    status: statusSchema.optional(),

    shortDescription: z.string()
      .max(5000)
      .nullable()
      .optional(),

    description: z.string()
      .max(100000)
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

    variant: simpleVariantSchema
      .partial()
      .optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Aucune modification fournie.',
  );

// ========================================
// LIST / FILTER / SORT / TRASH
// ========================================

export const productListSchema = z.strictObject({
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

  status: statusSchema.optional(),

  type: z.enum([
    'simple',
    'variable',
  ]).optional(),

  search: z.string()
    .trim()
    .max(100)
    .optional(),

  categoryId: z.uuid().optional(),

  brandId: z.uuid().optional(),

  trash: z.enum([
    'active',
    'trash',
    'all',
  ]).default('active'),

  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'name',
  ]).default('createdAt'),

  sortOrder: z.enum([
    'asc',
    'desc',
  ]).default('desc'),
});

// ========================================
// TYPES
// ========================================

export type CreateSimpleProductInput =
  z.infer<typeof createSimpleProductSchema>;

export type CreateVariableProductInput =
  z.infer<typeof createVariableProductSchema>;

export type CreateProductInput =
  z.infer<typeof createProductSchema>;

export type UpdateProductInput =
  z.infer<typeof updateProductSchema>;

export type ProductListInput =
  z.infer<typeof productListSchema>;
