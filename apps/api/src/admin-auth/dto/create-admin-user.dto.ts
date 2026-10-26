
import { z } from 'zod';

export const createAdminUserSchema = z.object({
  email: z.email().max(255).transform((value) =>
    value.trim().toLowerCase(),
  ),

  firstName: z.string()
    .trim()
    .min(1)
    .max(100),

  lastName: z.string()
    .trim()
    .min(1)
    .max(100),

  password: z.string()
    .min(12, 'Password must contain at least 12 characters.')
    .max(128),

  roleIds: z.array(z.uuid())
    .min(1, 'Assign at least one role.')
    .max(10)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Duplicate roles are not allowed.',
    ),
}).strict();

export type CreateAdminUserDto =
  z.infer<typeof createAdminUserSchema>;
