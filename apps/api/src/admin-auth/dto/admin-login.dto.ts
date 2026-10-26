
import { z } from 'zod';

export const adminLoginSchema = z.strictObject({
  email: z
    .email()
    .trim()
    .toLowerCase()
    .max(254),
  password: z
    .string()
    .min(1)
    .max(128),
});

export type AdminLoginDto = z.infer<typeof adminLoginSchema>;
