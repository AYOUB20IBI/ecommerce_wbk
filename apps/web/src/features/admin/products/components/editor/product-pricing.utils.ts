
export type PriceValidation = {
  valid: boolean;
  regularError: string | null;
  saleError: string | null;
};

const PRICE_PATTERN =
  /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export function normalizePriceInput(
  value: string,
): string {
  return value.trim();
}

export function isValidPrice(
  value: string,
): boolean {
  return PRICE_PATTERN.test(value);
}

export function priceToCents(
  value: string,
): bigint {
  if (!isValidPrice(value)) {
    throw new Error("Invalid price.");
  }

  const [whole, fractional = ""] = value.split(".");

  return (
    BigInt(whole) * BigInt(100) +
    BigInt(fractional.padEnd(2, "0"))
  );
}

export function formatPrice(
  value: string,
): string {
  if (!isValidPrice(value)) {
    return "—";
  }

  const [whole, fractional = ""] = value.split(".");

  const grouped = BigInt(whole).toLocaleString("en-US");

  // Don't display unnecessary decimals.
  const cents = fractional.padEnd(2, "0");

  if (cents === "00") {
    return grouped;
  }

  return `${grouped}.${cents.replace(/0$/, "")}`;
}

export function validatePrices(
  regularInput: string,
  saleInput: string,
  requireRegular: boolean,
): PriceValidation {
  const regular = normalizePriceInput(regularInput);
  const sale = normalizePriceInput(saleInput);

  let regularError: string | null = null;
  let saleError: string | null = null;

  if (requireRegular && regular === "") {
    regularError =
      "Regular price is required to publish this product.";
  } else if (
    regular !== "" &&
    !isValidPrice(regular)
  ) {
    regularError =
      "Enter a valid non-negative price with up to 2 optional decimal places.";
  }

  if (sale !== "") {
    if (!isValidPrice(sale)) {
      saleError =
        "Enter a valid sale price with up to 2 optional decimal places.";
    } else if (regular === "") {
      saleError =
        "Set a regular price before adding a sale price.";
    } else if (
      !regularError &&
      priceToCents(sale) > priceToCents(regular)
    ) {
      saleError =
        "Sale price cannot exceed regular price.";
    }
  }

  return {
    valid: regularError === null && saleError === null,
    regularError,
    saleError,
  };
}

export function getDiscountPercentage(
  regular: string,
  sale: string,
): number | null {
  if (
    !isValidPrice(regular) ||
    !isValidPrice(sale)
  ) {
    return null;
  }

  const regularCents = priceToCents(regular);
  const saleCents = priceToCents(sale);

  if (
    regularCents === BigInt(0) ||
    saleCents >= regularCents
  ) {
    return null;
  }

  const basisPoints =
    ((regularCents - saleCents) * BigInt(10000)) /
    regularCents;

  return Number(basisPoints) / 100;
}
