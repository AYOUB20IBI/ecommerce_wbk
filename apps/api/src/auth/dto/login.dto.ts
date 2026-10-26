
import { z } from 'zod';

export const loginSchema = z.strictObject({
  email: z
    .string({
      error: 'L’adresse e-mail est obligatoire.',
    })
    .trim()
    .min(1, 'L’adresse e-mail est obligatoire.')
    .pipe(
      z.email({
        error: 'Veuillez saisir une adresse e-mail valide.',
      }),
    )
    .transform((email) => email.toLowerCase()),

  password: z
    .string({
      error: 'Le mot de passe est obligatoire.',
    })
    .min(1, 'Le mot de passe est obligatoire.'),
});

export type LoginDto = z.infer<typeof loginSchema>;
