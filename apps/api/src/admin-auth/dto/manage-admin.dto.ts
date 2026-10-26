
import { z } from 'zod';

export const uuidParamSchema = z.uuid();

export const updateAdminSchema = z
  .object({
    email: z.email()
      .max(255)
      .transform((value) => value.trim().toLowerCase())
      .optional(),

    firstName: z.string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    lastName: z.string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );

export const roleIdsSchema = z
  .object({
    roleIds: z.array(z.uuid())
      .min(1)
      .max(10)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Duplicate roles are not allowed.',
      ),
  })
  .strict();

export const adminStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const roleNameSchema = z.string()
  .trim()
  .regex(
    /^[a-z][a-z0-9_]{2,79}$/,
    'Role name must be snake_case (3-80 characters).',
  );

export const createRoleSchema = z
  .object({
    name: roleNameSchema,
    description: z.string()
      .trim()
      .max(1000)
      .nullable()
      .optional(),

    permissionIds: z.array(z.uuid())
      .max(200)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Duplicate permissions are not allowed.',
      )
      .default([]),
  })
  .strict();

export const updateRoleSchema = z
  .object({
    name: roleNameSchema.optional(),
    description: z.string()
      .trim()
      .max(1000)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );

export const permissionIdsSchema = z
  .object({
    permissionIds: z.array(z.uuid())
      .max(200)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Duplicate permissions are not allowed.',
      ),
  })
  .strict();

export type UpdateAdminInput =
  z.infer<typeof updateAdminSchema>;

export type CreateRoleInput =
  z.infer<typeof createRoleSchema>;

export type UpdateRoleInput =
  z.infer<typeof updateRoleSchema>;
