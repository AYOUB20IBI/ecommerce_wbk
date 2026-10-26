
import { z } from 'zod';

export const registerSchema = z.strictObject({
  email: z
    .string({
      error: 'Veuillez saisir votre adresse e-mail.',
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
      error: 'Veuillez saisir un mot de passe.',
    })
    .min(1, 'Le mot de passe est obligatoire.')
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
    .max(128, 'Le mot de passe est trop long.'),

  firstName: z
    .string({
      error: 'Le prénom est obligatoire.',
    })
    .trim()
    .min(1, 'Le prénom est obligatoire.')
    .max(100, 'Le prénom est trop long.'),

  lastName: z
    .string({
      error: 'Le nom est obligatoire.',
    })
    .trim()
    .min(1, 'Le nom est obligatoire.')
    .max(100, 'Le nom est trop long.'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
