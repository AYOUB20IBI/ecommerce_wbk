
import { z } from 'zod';

export const taxonomyIdSchema = z.uuid();

export const taxonomyKindSchema = z.enum([
  'brands',
  'categories',
  'tags',
]);

export type TaxonomyKind =
  z.infer<typeof taxonomyKindSchema>;

const name = z.string()
  .trim()
  .min(2, 'Le nom est trop court.')
  .max(150, 'Le nom est trop long.');

const slug = z.string()
  .trim()
  .toLowerCase()
  .min(2, 'Le slug est obligatoire.')
  .max(150)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Format du slug invalide.',
  );

const description = z.string()
  .trim()
  .max(5000, 'Description trop longue.')
  .nullable()
  .optional();

export const createBrandSchema = z.strictObject({
  name,
  slug,
  description,
});

export const updateBrandSchema =
  createBrandSchema.partial().refine(
    v => Object.keys(v).length > 0,
    'Aucune modification fournie.',
  );

export const createTagSchema = z.strictObject({
  name,
  slug,
  description,
});

export const updateTagSchema =
  createTagSchema.partial().refine(
    v => Object.keys(v).length > 0,
    'Aucune modification fournie.',
  );

export const createCategorySchema = z.strictObject({
  name,
  slug,
  description,
  parentId: z.uuid().nullable().default(null),
});

export const updateCategorySchema = z.strictObject({
  name: name.optional(),
  slug: slug.optional(),
  description,
  parentId: z.uuid().nullable().optional(),
}).refine(
  v => Object.keys(v).length > 0,
  'Aucune modification fournie.',
);

export const taxonomyListSchema = z.strictObject({
  page: z.coerce.number()
    .int().min(1).max(100000).default(1),

  limit: z.coerce.number()
    .int().min(1).max(100).default(20),

  search: z.string()
    .trim().max(100).optional(),
});

export type CreateBrandInput =
  z.infer<typeof createBrandSchema>;

export type UpdateBrandInput =
  z.infer<typeof updateBrandSchema>;

export type CreateTagInput =
  z.infer<typeof createTagSchema>;

export type UpdateTagInput =
  z.infer<typeof updateTagSchema>;

export type CreateCategoryInput =
  z.infer<typeof createCategorySchema>;

export type UpdateCategoryInput =
  z.infer<typeof updateCategorySchema>;

export type TaxonomyListInput =
  z.infer<typeof taxonomyListSchema>;
