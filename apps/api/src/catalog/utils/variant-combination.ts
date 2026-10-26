
import { createHash } from 'node:crypto';
import { z } from 'zod';

const uuidSchema = z.uuid();

export const variantOptionSchema = z.strictObject({
  attributeId: uuidSchema,
  valueId: uuidSchema,
});

export type VariantOption = z.infer<
  typeof variantOptionSchema
>;

export function buildCombinationKey(
  options: VariantOption[],
): string {
  if (options.length === 0) {
    throw new Error('VARIANT_OPTIONS_REQUIRED');
  }

  const parsed = z.array(variantOptionSchema)
    .min(1)
    .max(30)
    .parse(options);

  const uniqueAttributes = new Set(
    parsed.map((option) => option.attributeId),
  );

  if (uniqueAttributes.size !== parsed.length) {
    throw new Error('DUPLICATE_VARIANT_ATTRIBUTE');
  }

  const canonical = parsed
    .map((option) => ({
      attributeId: option.attributeId.toLowerCase(),
      valueId: option.valueId.toLowerCase(),
    }))
    .sort((a, b) =>
      a.attributeId.localeCompare(b.attributeId),
    )
    .map((option) =>
      `${option.attributeId}:${option.valueId}`,
    )
    .join('|');

  return createHash('sha256')
    .update(canonical)
    .digest('hex');
}
