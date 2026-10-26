
import { z } from 'zod';

export const cartItemIdSchema = z.uuid();

export const addCartItemSchema = z.strictObject({
  variantId: z.uuid(),

  quantity: z.number()
    .int('La quantité doit être un entier.')
    .min(1, 'La quantité minimale est 1.')
    .max(999, 'La quantité maximale est 999.'),
});

export const updateCartItemSchema = z.strictObject({
  quantity: z.number()
    .int('La quantité doit être un entier.')
    .min(1, 'La quantité minimale est 1.')
    .max(999, 'La quantité maximale est 999.'),
});

export type AddCartItemInput =
  z.infer<typeof addCartItemSchema>;

export type UpdateCartItemInput =
  z.infer<typeof updateCartItemSchema>;
