
export type IdentifierValidation = {
  valid: boolean;
  skuError: string | null;
  eanError: string | null;
};

export function normalizeIdentifier(
  value: string,
): string {
  return value.trim();
}

export function validateIdentifiers(
  skuInput: string,
  eanInput: string,
): IdentifierValidation {
  const sku = normalizeIdentifier(skuInput);
  const ean = normalizeIdentifier(eanInput);

  let skuError: string | null = null;
  let eanError: string | null = null;

  if (sku.length > 100) {
    skuError = "SKU cannot exceed 100 characters.";
  }

  if (ean.length > 32) {
    eanError = "Barcode cannot exceed 32 characters.";
  }

  return {
    valid: skuError === null && eanError === null,
    skuError,
    eanError,
  };
}

export function toOptionalIdentifier(
  value: string,
): string | null {
  return normalizeIdentifier(value) || null;
}
