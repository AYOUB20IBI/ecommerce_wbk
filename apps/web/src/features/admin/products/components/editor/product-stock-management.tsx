
"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Package,
  PackageX,
  ShieldOff,
} from "lucide-react";

export type StockStatus =
  | "in_stock"
  | "out_of_stock"
  | "not_tracked"
  | "inactive";

type Props = {
  manageStock: boolean;
  stockQuantity: string;
  isActive: boolean;
  disabled?: boolean;
  onManageStockChange: (value: boolean) => void;
  onStockQuantityChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
};

const MAX_STOCK = 2147483647;

export function isValidStockQuantity(value: string): boolean {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return false;
  }

  const quantity = Number(value);

  return (
    Number.isSafeInteger(quantity) &&
    quantity >= 0 &&
    quantity <= MAX_STOCK
  );
}

export function getStockStatus(
  manageStock: boolean,
  stockQuantity: string,
  isActive: boolean,
): StockStatus {
  if (!isActive) return "inactive";
  if (!manageStock) return "not_tracked";

  if (!isValidStockQuantity(stockQuantity)) {
    return "out_of_stock";
  }

  return Number(stockQuantity) > 0
    ? "in_stock"
    : "out_of_stock";
}

const statusInfo: Record<
  StockStatus,
  {
    title: string;
    description: string;
    tone: string;
  }
> = {
  in_stock: {
    title: "In Stock",
    description:
      "Stock tracking is enabled and quantity is available.",
    tone:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  out_of_stock: {
    title: "Out of Stock",
    description:
      "No available quantity is currently recorded.",
    tone:
      "border-amber-200 bg-amber-50 text-amber-700",
  },
  not_tracked: {
    title: "Stock Not Tracked",
    description:
      "Inventory quantity is not used while stock tracking is disabled.",
    tone:
      "border-slate-200 bg-slate-50 text-slate-600",
  },
  inactive: {
    title: "Inactive Variant",
    description:
      "This variant is disabled regardless of its stock quantity.",
    tone:
      "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 text-sm text-[#172444] outline-none focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10 disabled:cursor-not-allowed disabled:bg-[#F5F6FA] disabled:text-[#9AA5B8]";

export function ProductStockManagement({
  manageStock,
  stockQuantity,
  isActive,
  disabled = false,
  onManageStockChange,
  onStockQuantityChange,
  onIsActiveChange,
}: Props) {
  const invalidQuantity =
    manageStock && !isValidStockQuantity(stockQuantity);

  const status = getStockStatus(
    manageStock,
    stockQuantity,
    isActive,
  );

  const info = statusInfo[status];

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Package className="size-4 text-[#6D5DF6]" />

        <h3 className="text-sm font-bold text-[#172444]">
          Stock Management
        </h3>
      </div>

      <div className="space-y-4 rounded-xl border border-[#E8EAF3] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={manageStock}
            disabled={disabled}
            onChange={(event) =>
              onManageStockChange(event.target.checked)
            }
            className="mt-0.5 size-4 accent-[#6D5DF6]"
          />

          <span className="space-y-1">
            <span className="block text-xs font-semibold text-[#465575]">
              Manage Stock
            </span>

            <span className="block text-[11px] leading-5 text-[#8A97AC]">
              Enable quantity-based inventory tracking for
              this variant.
            </span>
          </span>
        </label>

        <div className="border-t border-[#EDF0F6] pt-4">
          <label
            htmlFor="product-stock-quantity"
            className="mb-2 block text-xs font-semibold text-[#465575]"
          >
            Stock Quantity
          </label>

          <input
            id="product-stock-quantity"
            type="number"
            min={0}
            max={MAX_STOCK}
            step={1}
            inputMode="numeric"
            value={stockQuantity}
            disabled={disabled || !manageStock}
            aria-invalid={invalidQuantity}
            aria-describedby="product-stock-help"
            onChange={(event) =>
              onStockQuantityChange(event.target.value)
            }
            className={`${inputClass} ${
              invalidQuantity ? "border-red-300" : ""
            }`}
          />

          <p
            id="product-stock-help"
            className="mt-2 text-[11px] leading-5 text-[#8A97AC]"
          >
            {manageStock
              ? "Enter the available quantity as a non-negative whole number."
              : "Enable Manage Stock to edit quantity. The previous value is preserved."}
          </p>

          {invalidQuantity && (
            <p
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-xs text-red-600"
            >
              <CircleAlert className="size-4" />
              Enter a whole number between 0 and
              2,147,483,647.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E8EAF3] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={isActive}
            disabled={disabled}
            onChange={(event) =>
              onIsActiveChange(event.target.checked)
            }
            className="mt-0.5 size-4 accent-[#6D5DF6]"
          />

          <span className="space-y-1">
            <span className="block text-xs font-semibold text-[#465575]">
              Active Variant
            </span>

            <span className="block text-[11px] leading-5 text-[#8A97AC]">
              Disable this variant without deleting its details.
            </span>
          </span>
        </label>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border p-4 ${info.tone}`}
      >
        <div className="flex items-center gap-2">
          {status === "in_stock" ? (
            <CircleCheck className="size-5" />
          ) : status === "out_of_stock" ? (
            <PackageX className="size-5" />
          ) : status === "inactive" ? (
            <ShieldOff className="size-5" />
          ) : (
            <CircleHelp className="size-5" />
          )}

          <p className="text-sm font-bold">
            {invalidQuantity
              ? "Invalid Stock Quantity"
              : info.title}
          </p>
        </div>

        <p className="mt-2 text-xs leading-5">
          {invalidQuantity
            ? "Correct the quantity before saving."
            : info.description}
        </p>

        {manageStock && !invalidQuantity && isActive && (
          <p className="mt-2 text-xs font-semibold">
            Available quantity: {stockQuantity}
          </p>
        )}
      </div>

      <p className="text-[11px] leading-5 text-[#8794AC]">
        Stock status is a live preview derived from the
        variant&apos;s inventory fields. No separate stock
        status is stored.
      </p>
    </section>
  );
}
