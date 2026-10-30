
"use client";

import {
  BadgePercent,
  CircleAlert,
  CircleCheck,
  Info,
  Tag,
} from "lucide-react";

import {
  formatPrice,
  getDiscountPercentage,
  validatePrices,
} from "./product-pricing.utils";

type Props = {
  regularPrice: string;
  salePrice: string;
  onRegularPriceChange: (value: string) => void;
  onSalePriceChange: (value: string) => void;
  disabled?: boolean;
  requireRegular?: boolean;
  currencyLabel?: string;
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 text-sm text-[#172444] outline-none transition focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FC] disabled:text-[#95A0B3]";

export function ProductPricing({
  regularPrice,
  salePrice,
  onRegularPriceChange,
  onSalePriceChange,
  disabled = false,
  requireRegular = false,
  currencyLabel = "",
}: Props) {
  const validation = validatePrices(
    regularPrice,
    salePrice,
    requireRegular,
  );

  const discount = validation.valid
    ? getDiscountPercentage(
        regularPrice.trim(),
        salePrice.trim(),
      )
    : null;

  const regularValid =
    regularPrice.trim() !== "" &&
    validation.regularError === null;

  const saleValid =
    salePrice.trim() !== "" &&
    validation.saleError === null;

  const effectivePrice =
    saleValid ? salePrice.trim() : regularPrice.trim();

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="product-regular-price"
            className="block text-xs font-semibold text-[#465575]"
          >
            Regular Price
            {requireRegular ? " *" : ""}
          </label>

          <div className="relative">
            <input
              id="product-regular-price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={13}
              value={regularPrice}
              onChange={(event) =>
                onRegularPriceChange(event.target.value)
              }
              disabled={disabled}
              aria-invalid={Boolean(validation.regularError)}
              aria-describedby={
                validation.regularError
                  ? "regular-price-error"
                  : "regular-price-help"
              }
              placeholder="0.00"
              className={`${inputClass} pr-10 ${
                validation.regularError
                  ? "border-red-300 focus:border-red-500"
                  : ""
              }`}
            />

            <Tag className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A0AAC0]" />
          </div>

          {validation.regularError ? (
            <p
              id="regular-price-error"
              role="alert"
              className="flex items-start gap-1.5 text-xs text-red-600"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {validation.regularError}
            </p>
          ) : (
            <p
              id="regular-price-help"
              className="text-[11px] leading-5 text-[#8A97AC]"
            >
              Standard selling price. Use a dot for decimals.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="product-sale-price"
            className="block text-xs font-semibold text-[#465575]"
          >
            Sale Price
          </label>

          <div className="relative">
            <input
              id="product-sale-price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={13}
              value={salePrice}
              onChange={(event) =>
                onSalePriceChange(event.target.value)
              }
              disabled={disabled}
              aria-invalid={Boolean(validation.saleError)}
              aria-describedby={
                validation.saleError
                  ? "sale-price-error"
                  : "sale-price-help"
              }
              placeholder="0.00"
              className={`${inputClass} pr-10 ${
                validation.saleError
                  ? "border-red-300 focus:border-red-500"
                  : ""
              }`}
            />

            <BadgePercent className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A0AAC0]" />
          </div>

          {validation.saleError ? (
            <p
              id="sale-price-error"
              role="alert"
              className="flex items-start gap-1.5 text-xs text-red-600"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {validation.saleError}
            </p>
          ) : (
            <p
              id="sale-price-help"
              className="text-[11px] leading-5 text-[#8A97AC]"
            >
              Optional discounted price. Cannot exceed regular price.
            </p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-[#E9E8F9] bg-[#FAF9FF] p-4">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-[#6D5DF6]" />

          <h3 className="text-xs font-bold text-[#344362]">
            Pricing Preview
          </h3>
        </div>

        {validation.valid && regularValid ? (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#8290AC]">
                Effective Price
              </p>

              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-[#172444]">
                  {formatPrice(effectivePrice)}
                  {currencyLabel
                    ? ` ${currencyLabel}`
                    : ""}
                </span>

                {saleValid &&
                  discount !== null && (
                    <span className="text-sm text-[#93A0B5] line-through">
                      {formatPrice(regularPrice.trim())}
                    </span>
                  )}
              </div>
            </div>

            {discount !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <BadgePercent className="size-4" />
                {discount.toFixed(2)}% off
              </span>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-6 text-[#8794AC]">
            {validation.valid
              ? "Enter a regular price to see the pricing preview."
              : "Correct the pricing fields to see a valid preview."}
          </p>
        )}

        {validation.valid && (
          <p className="mt-4 flex items-center gap-2 text-[11px] text-[#66758F]">
            <CircleCheck className="size-3.5 text-emerald-600" />
            Price format is valid.
          </p>
        )}
      </section>

      <p className="text-[11px] leading-5 text-[#8A97AC]">
        Prices are stored as decimal values. Tax calculation,
        currency formatting and scheduled promotions belong
        to the store configuration and pricing services.
      </p>
    </div>
  );
}
