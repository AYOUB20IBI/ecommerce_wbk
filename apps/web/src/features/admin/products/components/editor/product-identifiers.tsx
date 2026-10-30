
"use client";

import {
  Barcode,
  CircleAlert,
  Fingerprint,
  Info,
} from "lucide-react";

import {
  validateIdentifiers,
} from "./product-identifiers.utils";

type Props = {
  sku: string;
  ean: string;
  onSkuChange: (value: string) => void;
  onEanChange: (value: string) => void;
  disabled?: boolean;
  serverErrors?: {
    sku?: string;
    ean?: string;
  };
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 pr-10 text-sm text-[#172444] outline-none transition focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FC] disabled:text-[#95A0B3]";

export function ProductIdentifiers({
  sku,
  ean,
  onSkuChange,
  onEanChange,
  disabled = false,
  serverErrors,
}: Props) {
  const validation = validateIdentifiers(sku, ean);

  const skuError =
    validation.skuError ?? serverErrors?.sku ?? null;

  const eanError =
    validation.eanError ?? serverErrors?.ean ?? null;

  return (
    <section className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="product-sku"
            className="block text-xs font-semibold text-[#465575]"
          >
            SKU
            <span className="ml-2 font-normal text-[#93A0B5]">
              Optional
            </span>
          </label>

          <div className="relative">
            <input
              id="product-sku"
              type="text"
              value={sku}
              maxLength={110}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              placeholder="e.g. TSHIRT-BLK-M"
              aria-invalid={Boolean(skuError)}
              aria-describedby={
                skuError ? "product-sku-error" : "product-sku-help"
              }
              onChange={(event) =>
                onSkuChange(event.target.value)
              }
              className={`${inputClass} ${
                skuError ? "border-red-300" : ""
              }`}
            />

            <Fingerprint className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A0AAC0]" />
          </div>

          {skuError ? (
            <p
              id="product-sku-error"
              role="alert"
              className="flex items-start gap-1.5 text-xs text-red-600"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {skuError}
            </p>
          ) : (
            <p
              id="product-sku-help"
              className="text-[11px] leading-5 text-[#8A97AC]"
            >
              Unique stock keeping unit. Maximum 100 characters.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="product-barcode"
            className="block text-xs font-semibold text-[#465575]"
          >
            EAN / Barcode
            <span className="ml-2 font-normal text-[#93A0B5]">
              Optional
            </span>
          </label>

          <div className="relative">
            <input
              id="product-barcode"
              type="text"
              value={ean}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              placeholder="Enter barcode"
              aria-invalid={Boolean(eanError)}
              aria-describedby={
                eanError
                  ? "product-barcode-error"
                  : "product-barcode-help"
              }
              onChange={(event) =>
                onEanChange(event.target.value)
              }
              className={`${inputClass} ${
                eanError ? "border-red-300" : ""
              }`}
            />

            <Barcode className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#A0AAC0]" />
          </div>

          {eanError ? (
            <p
              id="product-barcode-error"
              role="alert"
              className="flex items-start gap-1.5 text-xs text-red-600"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {eanError}
            </p>
          ) : (
            <p
              id="product-barcode-help"
              className="text-[11px] leading-5 text-[#8A97AC]"
            >
              Unique barcode. Maximum 32 characters.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-[#E9E8F9] bg-[#FAF9FF] p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-[#6D5DF6]" />

        <p className="text-[11px] leading-5 text-[#66758F]">
          SKU and Barcode are optional. When provided, each
          must be unique across product variants. Duplicate
          values are checked by the server when saving.
        </p>
      </div>
    </section>
  );
}
