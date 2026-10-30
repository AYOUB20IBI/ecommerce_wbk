
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { CategoryTreeFilter } from "./category-tree-filter";
import {
  ProductAuditInfo,
  type ProductAuthorInfo,
} from "./product-audit-info";

import { getMediaPreviewUrl } from "@/features/admin/media/lib/media-api";

type View = "all" | "published" | "draft" | "private" | "trash";
type SortBy = "createdAt" | "updatedAt" | "name" | "price";
type SortOrder = "asc" | "desc";

type Product = {
  id: string;
  name: string;
  slug: string;
  type: "simple" | "variable";
  status: string;
  sku: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  totalStock: number;
  isFeatured: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string } | null;
  categories?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string }>;
  featuredImage: {
    id: string;
    externalUrl: string | null;
    storageKey: string | null;
    altText: string | null;
  } | null;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type ListData = {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Counts = Record<View, number>;
type AuthorsMap = Record<string, ProductAuthorInfo>;

type BulkResult = {
  deletedIds: string[];
  failed: Array<{ id: string; status: number }>;
};

type Props = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPurge: boolean;
  canViewAdminDetails: boolean;
};

const PAGE_SIZE = 20;

const TABS: Array<{ id: View; label: string }> = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "private", label: "Private" },
  { id: "trash", label: "Trash" },
];

const MEDIA_BASE = (
  process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL ?? ""
).replace(/\/+$/, "");

const selectClass =
  "h-10 w-full rounded-lg border border-[#E4E8F1] bg-white px-3 text-xs text-[#344362] outline-none focus:border-[#6D5DF6]";

async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  let result: ApiResponse<T>;

  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ??
        `Request failed (${response.status}).`,
    );
  }

  if (result.data === undefined) {
    throw new Error("Missing API response data.");
  }

  return result.data;
}

/**
 * Returns the real thumbnail preview URL.
 *
 * Supported:
 * - Public HTTP/HTTPS external images
 * - Absolute storage URLs
 * - Local NestJS uploads
 * - Storage keys containing "uploads/"
 * - Storage keys containing YYYY/MM/file.webp
 *
 * Local uploads use the authenticated Next.js preview route.
 */
function productImageUrl(product: Product): string | null {
  const image = product.featuredImage;

  if (!image) return null;

  if (image.externalUrl) {
    return getMediaPreviewUrl({
      url: image.externalUrl,
    });
  }

  const key = image.storageKey?.trim();

  if (!key) return null;

  if (/^https?:\/\//i.test(key)) {
    return getMediaPreviewUrl({ url: key });
  }

  const segments = key
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "")
    .split("/");

  if (
    segments.length < 3 ||
    segments.length > 8 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        !/^[a-zA-Z0-9._-]+$/.test(segment),
    )
  ) {
    return null;
  }

  const encoded = segments
    .map(encodeURIComponent)
    .join("/");

  if (!MEDIA_BASE) {
    return `/api/admin/media-preview/${encoded}`;
  }

  try {
    const base = new URL(MEDIA_BASE);

    if (
      ["localhost", "127.0.0.1"].includes(base.hostname) &&
      base.port === "3001"
    ) {
      return `/api/admin/media-preview/${encoded}`;
    }

    const prefix = base.pathname.replace(/\/+$/, "");
    const uploadPrefix = prefix.endsWith("/uploads")
      ? ""
      : "/uploads";

    return getMediaPreviewUrl({
      url: `${base.origin}${prefix}${uploadPrefix}/${encoded}`,
    });
  } catch {
    return null;
  }
}

function ProductThumbnail({
  product,
}: {
  product: Product;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(
    null,
  );

  const image = productImageUrl(product);
  const failed = image !== null && failedUrl === image;

  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E9ECF4] bg-[#F7F8FC]">
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={product.featuredImage?.altText || product.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(image)}
          className="size-full object-contain"
        />
      ) : (
        <ImageOff className="size-5 text-[#A9B1C0]" />
      )}
    </div>
  );
}

function formatMoney(value: string | null): string {
  if (value === null) return "—";

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

function Price({ product }: { product: Product }) {
  const min = formatMoney(product.minPrice);
  const showRange =
    product.minPrice !== null &&
    product.maxPrice !== null &&
    Number(product.minPrice) !== Number(product.maxPrice);

  return (
    <span className="text-xs font-semibold text-[#293955]">
      {min}
      {showRange && ` – ${formatMoney(product.maxPrice)}`}
    </span>
  );
}

function Stock({ product }: { product: Product }) {
  const inStock = product.totalStock > 0;

  return (
    <span
      className={`text-xs font-semibold ${
        inStock ? "text-emerald-700" : "text-amber-700"
      }`}
    >
      {inStock ? "In stock" : "0 tracked"}{" "}
      ({product.totalStock})
    </span>
  );
}

function Taxonomies({
  items,
}: {
  items?: Array<{ id: string; name: string }>;
}) {
  return (
    <span className="text-xs text-[#6554D8]">
      {items?.map((item) => item.name).join(", ") || "—"}
    </span>
  );
}

function SortArrow({
  column,
  sortBy,
  order,
}: {
  column: SortBy;
  sortBy: SortBy;
  order: SortOrder;
}) {
  if (column !== sortBy) {
    return <ArrowDown className="size-3 text-[#BDC5D2]" />;
  }

  return order === "asc" ? (
    <ArrowUp className="size-3 text-[#6D5DF6]" />
  ) : (
    <ArrowDown className="size-3 text-[#6D5DF6]" />
  );
}

function LookupFilter({
  kind,
  value,
  onChange,
}: {
  kind: "tags" | "brands";
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");

        try {
          const params = new URLSearchParams({
            kind,
            search: search.trim(),
          });

          const result = await api<{
            items: Array<{ id: string; name: string }>;
          }>(
            `/api/admin/catalog-filter-options?${params}`,
            { signal: controller.signal },
          );

          if (!controller.signal.aborted) {
            setItems(result.items);
          }
        } catch (caught) {
          if (!controller.signal.aborted) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Options unavailable.",
            );
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, open, search]);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`${selectClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">
          {value ? selectedName || kind : `All ${kind}`}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(300px,85vw)] rounded-xl border border-[#E4E8F1] bg-white p-2 shadow-xl">
          <input
            type="search"
            aria-label={`Search ${kind}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${kind}...`}
            className={selectClass}
          />

          <div className="mt-2 max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSelectedName("");
                setSearch("");
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#6554D8] hover:bg-[#F5F3FF]"
            >
              All {kind}
            </button>

            {loading && (
              <p className="p-3 text-xs text-[#8794AC]">
                Loading...
              </p>
            )}

            {error && (
              <p className="p-3 text-xs text-red-600">
                {error}
              </p>
            )}

            {!loading &&
              !error &&
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onChange(item.id);
                    setSelectedName(item.name);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[#465575] hover:bg-[#F5F3FF]"
                >
                  {item.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RowActions({
  product,
  canUpdate,
  canDelete,
  canPurge,
  busy,
  onAction,
  onPurge,
}: {
  product: Product;
  canUpdate: boolean;
  canDelete: boolean;
  canPurge: boolean;
  busy: boolean;
  onAction: (
    product: Product,
    action: "trash" | "restore",
  ) => void;
  onPurge: (product: Product) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!product.isDeleted && canUpdate && (
        <Link
          href={`/admin/products/${product.id}/edit`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6554D8] hover:underline"
        >
          <Pencil className="size-3" />
          Edit
        </Link>
      )}

      {!product.isDeleted && canDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(product, "trash")}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 disabled:opacity-40"
        >
          <Trash2 className="size-3" />
          Trash
        </button>
      )}

      {product.isDeleted && canUpdate && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(product, "restore")}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-40"
        >
          <RotateCcw className="size-3" />
          Restore
        </button>
      )}

      {product.isDeleted && canPurge && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPurge(product)}
          className="text-[11px] font-semibold text-red-700 disabled:opacity-40"
        >
          Delete forever
        </button>
      )}
    </div>
  );
}

export function ProductsManager({
  canCreate,
  canUpdate,
  canDelete,
  canPurge,
  canViewAdminDetails,
}: Props) {
  const [view, setView] = useState<View>("all");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [authors, setAuthors] = useState<AuthorsMap>({});

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [type, setType] = useState("");

  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [purgeProduct, setPurgeProduct] =
    useState<Product | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      trash: view === "trash" ? "trash" : "active",
      sortBy,
      sortOrder: order,
    });

    if (
      view === "published" ||
      view === "draft" ||
      view === "private"
    ) {
      params.set("status", view);
    }

    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    if (tagId) params.set("tagId", tagId);
    if (brandId) params.set("brandId", brandId);
    if (stockStatus) params.set("stockStatus", stockStatus);
    if (type) params.set("type", type);

    return params.toString();
  }, [
    page,
    view,
    sortBy,
    order,
    search,
    categoryId,
    tagId,
    brandId,
    stockStatus,
    type,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");

        try {
          const list = await api<ListData>(
            `/api/admin/products?${query}`,
            { signal: controller.signal },
          );

          if (
            !Array.isArray(list.items) ||
            !list.pagination
          ) {
            throw new Error("Invalid products response.");
          }

          const ids = list.items.map((item) => item.id);
          let nextAuthors: AuthorsMap = {};

          if (ids.length > 0) {
            try {
              const params = new URLSearchParams({
                kind: "authors",
                ids: ids.join(","),
              });

              const result = await api<{
                items: AuthorsMap;
              }>(
                `/api/admin/products/presentation?${params}`,
                { signal: controller.signal },
              );

              nextAuthors = result.items;
            } catch (caught) {
              if (controller.signal.aborted) return;

              console.error(
                "Product authors unavailable:",
                caught instanceof Error
                  ? caught.message
                  : "Unknown error",
              );
            }
          }

          if (!controller.signal.aborted) {
            setProducts(list.items);
            setAuthors(nextAuthors);
            setTotal(list.pagination.total);
            setPages(
              Math.max(1, list.pagination.totalPages),
            );
          }
        } catch (caught) {
          if (!controller.signal.aborted) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load products.",
            );
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await api<Counts>(
            "/api/admin/products/counts",
            { signal: controller.signal },
          );

          if (!controller.signal.aborted) {
            setCounts(result);
          }
        } catch {
          // Preserve previous counts.
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refreshKey]);

  function resetPageContext() {
    setPage(1);
    setSelected([]);
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function sort(column: SortBy) {
    if (sortBy === column) {
      setOrder((current) =>
        current === "asc" ? "desc" : "asc",
      );
    } else {
      setSortBy(column);
      setOrder(column === "name" ? "asc" : "desc");
    }

    resetPageContext();
  }

  const selectedSet = new Set(selected);

  const allSelected =
    products.length > 0 &&
    products.every((product) =>
      selectedSet.has(product.id),
    );

  function toggleAll() {
    setSelected(
      allSelected
        ? []
        : products.map((product) => product.id),
    );
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function action(
    product: Product,
    kind: "trash" | "restore" | "permanent",
  ) {
    if (busy) return;

    if (
      kind === "trash" &&
      !window.confirm(`Move "${product.name}" to Trash?`)
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api<unknown>(
        `/api/admin/products/${product.id}?action=${kind}`,
        {
          method: kind === "restore" ? "POST" : "DELETE",
        },
      );

      setNotice(
        kind === "trash"
          ? "Product moved to Trash."
          : kind === "restore"
            ? "Product restored."
            : "Product permanently deleted.",
      );

      setPurgeProduct(null);
      setPurgeConfirm("");
      setSelected([]);

      if (products.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }

      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function bulkTrash() {
    if (!canDelete || busy || selected.length === 0) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await api<BulkResult>(
        "/api/admin/products/bulk-trash",
        {
          method: "POST",
          body: JSON.stringify({ ids: selected }),
        },
      );

      setSelected(result.failed.map((item) => item.id));
      setBulkConfirm(false);

      setNotice(
        `${result.deletedIds.length} product(s) moved to Trash.` +
          (result.failed.length
            ? ` ${result.failed.length} failed.`
            : ""),
      );

      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Bulk Trash failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function rowActions(product: Product) {
    return (
      <RowActions
        product={product}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canPurge={canPurge}
        busy={busy}
        onAction={(item, kind) =>
          void action(item, kind)
        }
        onPurge={(item) => {
          setPurgeProduct(item);
          setPurgeConfirm("");
        }}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B97B0]">
            Catalog
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#172444]">
            Products
          </h1>
          <p className="mt-1 text-sm text-[#8290AC]">
            Manage your store catalog.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/admin/products/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#6D5DF6] px-4 text-xs font-bold text-white hover:bg-[#5849DB]"
          >
            <Plus className="size-4" />
            Add New Product
          </Link>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          {notice}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-[#E6E9F2] bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-[#EDF0F6] px-4 pt-4">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => {
                setView(tab.id);
                resetPageContext();
              }}
              aria-current={
                view === tab.id ? "page" : undefined
              }
              className={`shrink-0 border-b-2 px-3 pb-3 text-xs font-semibold ${
                view === tab.id
                  ? "border-[#6D5DF6] text-[#6554D8]"
                  : "border-transparent text-[#8490A6]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-[#F0EEFF] px-1.5 py-0.5 text-[10px]">
                {counts?.[tab.id] ?? "…"}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 border-b border-[#EDF0F6] p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A0AABC]" />
              <input
                type="search"
                aria-label="Search products"
                maxLength={100}
                placeholder="Search products..."
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  resetPageContext();
                }}
                className={`${selectClass} pl-10`}
              />
            </div>

            <button
              type="button"
              aria-label="Refresh products"
              disabled={loading}
              onClick={refresh}
              className="flex size-10 items-center justify-center rounded-lg border border-[#E4E8F1] disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <CategoryTreeFilter
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id);
                resetPageContext();
              }}
            />

            <LookupFilter
              kind="tags"
              value={tagId}
              onChange={(id) => {
                setTagId(id);
                resetPageContext();
              }}
            />

            <LookupFilter
              kind="brands"
              value={brandId}
              onChange={(id) => {
                setBrandId(id);
                resetPageContext();
              }}
            />

            <select
              aria-label="Stock filter"
              value={stockStatus}
              onChange={(event) => {
                setStockStatus(event.target.value);
                resetPageContext();
              }}
              className={selectClass}
            >
              <option value="">All stock</option>
              <option value="instock">In stock</option>
              <option value="outofstock">Out of stock</option>
            </select>

            <select
              aria-label="Product type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                resetPageContext();
              }}
              className={selectClass}
            >
              <option value="">All types</option>
              <option value="simple">Simple</option>
              <option value="variable">Variable</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setCategoryId("");
                setTagId("");
                setBrandId("");
                setStockStatus("");
                setType("");
                setSearchInput("");
                setSearch("");
                resetPageContext();
              }}
              className="text-xs font-semibold text-[#6554D8]"
            >
              Reset filters
            </button>

            <div className="flex items-center gap-2">
              <select
                aria-label="Sort products"
                className={selectClass}
                value={sortBy}
                onChange={(event) =>
                  sort(event.target.value as SortBy)
                }
              >
                <option value="createdAt">Created date</option>
                <option value="updatedAt">Updated date</option>
                <option value="name">Name</option>
                <option value="price">Price</option>
              </select>

              <button
                type="button"
                aria-label="Reverse sort direction"
                onClick={() => {
                  setOrder((current) =>
                    current === "asc" ? "desc" : "asc",
                  );
                  resetPageContext();
                }}
                className="rounded-lg border border-[#E4E8F1] p-2"
              >
                {order === "asc" ? (
                  <ArrowUp className="size-4" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
              </button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#F6F3FF] p-3">
              <span className="text-xs font-semibold text-[#6554D8]">
                {selected.length} selected
              </span>

              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs text-[#687791] underline"
              >
                Clear
              </button>

              {canDelete && view !== "trash" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBulkConfirm(true)}
                  className="ml-auto rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Move to Trash
                </button>
              )}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1370px] text-left">
            <thead className="bg-[#FAFBFD] text-[11px] text-[#586784]">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelected}
                    disabled={
                      loading || busy || products.length === 0
                    }
                    onChange={toggleAll}
                    className="size-4 accent-[#6D5DF6]"
                  />
                </th>

                <th className="px-3 py-3">Image</th>

                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => sort("name")}
                    className="inline-flex items-center gap-1"
                  >
                    Name
                    <SortArrow
                      column="name"
                      sortBy={sortBy}
                      order={order}
                    />
                  </button>
                </th>

                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Categories</th>
                <th className="px-3 py-3">Tags</th>
                <th className="px-3 py-3">★</th>
                <th className="px-3 py-3">Brand</th>
                <th className="min-w-[155px] px-3 py-3">
                  Created Date / By
                </th>
                <th className="min-w-[155px] px-3 py-3">
                  Last Updated / By
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#ECEEF4]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center">
                    <LoaderCircle className="mx-auto size-6 animate-spin text-[#6D5DF6]" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-14 text-center text-xs text-[#8794AC]"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="align-top hover:bg-[#FAFBFF]"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.name}`}
                        checked={selectedSet.has(product.id)}
                        disabled={busy}
                        onChange={() => toggleOne(product.id)}
                        className="size-4 accent-[#6D5DF6]"
                      />
                    </td>

                    <td className="px-3 py-4">
                      <ProductThumbnail
                        key={
                          product.featuredImage?.id ??
                          product.id
                        }
                        product={product}
                      />
                    </td>

                    <td className="min-w-[185px] px-3 py-4">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="line-clamp-2 text-xs font-bold text-[#6554D8] hover:underline"
                      >
                        {product.name}
                      </Link>

                      <p className="mt-1 text-[10px] capitalize text-[#8894A9]">
                        {product.isDeleted
                          ? "Trashed"
                          : product.status}
                      </p>

                      <div className="mt-2">
                        {rowActions(product)}
                      </div>
                    </td>

                    <td className="max-w-28 break-all px-3 py-4 text-xs text-[#5D6B87]">
                      {product.sku || "—"}
                    </td>

                    <td className="px-3 py-4">
                      <Stock product={product} />
                    </td>

                    <td className="px-3 py-4">
                      <Price product={product} />
                    </td>

                    <td className="max-w-36 px-3 py-4">
                      <Taxonomies items={product.categories} />
                    </td>

                    <td className="max-w-36 px-3 py-4">
                      <Taxonomies items={product.tags} />
                    </td>

                    <td className="px-3 py-4">
                      <Star
                        className={`size-4 ${
                          product.isFeatured
                            ? "fill-amber-400 text-amber-400"
                            : "text-[#B9C2D0]"
                        }`}
                      />
                    </td>

                    <td className="px-3 py-4 text-xs text-[#6554D8]">
                      {product.brand?.name || "—"}
                    </td>

                    <td className="px-3 py-4">
                      <ProductAuditInfo
                        createdAt={product.createdAt}
                        updatedAt={product.updatedAt}
                        authors={authors[product.id]}
                        mode="created"
                        canViewAdminDetails={canViewAdminDetails}
                        compact
                      />
                    </td>

                    <td className="px-3 py-4">
                      <ProductAuditInfo
                        createdAt={product.createdAt}
                        updatedAt={product.updatedAt}
                        authors={authors[product.id]}
                        mode="updated"
                        canViewAdminDetails={canViewAdminDetails}
                        compact
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 bg-[#F7F8FC] p-3 md:hidden">
          {!loading && products.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-[#66748E]">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={busy}
                onChange={toggleAll}
                className="size-4 accent-[#6D5DF6]"
              />
              Select all on this page
            </label>
          )}

          {loading ? (
            <LoaderCircle className="mx-auto my-12 size-6 animate-spin text-[#6D5DF6]" />
          ) : products.length === 0 ? (
            <p className="rounded-xl bg-white p-10 text-center text-xs text-[#8794AC]">
              No products found.
            </p>
          ) : (
            products.map((product) => (
              <article
                key={product.id}
                className="rounded-xl border border-[#E8EBF3] bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${product.name}`}
                    checked={selectedSet.has(product.id)}
                    disabled={busy}
                    onChange={() => toggleOne(product.id)}
                    className="mt-1 size-4 shrink-0 accent-[#6D5DF6]"
                  />

                  <ProductThumbnail
                    key={
                      product.featuredImage?.id ??
                      product.id
                    }
                    product={product}
                  />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="line-clamp-2 text-sm font-bold text-[#6554D8]"
                    >
                      {product.name}
                    </Link>

                    <p className="mt-1 text-[11px] text-[#8794AC]">
                      SKU: {product.sku || "—"}
                    </p>
                  </div>

                  <Star
                    className={`size-4 shrink-0 ${
                      product.isFeatured
                        ? "fill-amber-400 text-amber-400"
                        : "text-[#BAC3D1]"
                    }`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[#F8F9FC] p-3">
                  <div>
                    <p className="text-[10px] text-[#8A97AC]">
                      Price
                    </p>
                    <Price product={product} />
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8A97AC]">
                      Stock
                    </p>
                    <Stock product={product} />
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8A97AC]">
                      Brand
                    </p>
                    <p className="text-xs text-[#53627C]">
                      {product.brand?.name || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8A97AC]">
                      Type
                    </p>
                    <p className="text-xs capitalize text-[#53627C]">
                      {product.type}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-[#8A97AC]">
                      Categories
                    </span>
                    <Taxonomies items={product.categories} />
                  </div>

                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-[#8A97AC]">
                      Tags
                    </span>
                    <Taxonomies items={product.tags} />
                  </div>
                </div>

                <div className="mt-4 border-t border-[#EDF0F5] pt-3">
                  <ProductAuditInfo
                    createdAt={product.createdAt}
                    updatedAt={product.updatedAt}
                    authors={authors[product.id]}
                    mode="both"
                    canViewAdminDetails={canViewAdminDetails}
                  />
                </div>

                <div className="mt-4 border-t border-[#EDF0F5] pt-3">
                  {rowActions(product)}
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F6] p-4">
          <p className="text-xs text-[#8290AC]">
            {total === 0
              ? "0 products"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                  page * PAGE_SIZE,
                  total,
                )} of ${total}`}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8794AC]">
              {page} / {pages}
            </span>

            <button
              type="button"
              disabled={page <= 1 || loading}
              aria-label="Previous page"
              onClick={() => {
                setPage((current) => current - 1);
                setSelected([]);
              }}
              className="rounded-lg border border-[#E4E8F1] p-2 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              disabled={page >= pages || loading}
              aria-label="Next page"
              onClick={() => {
                setPage((current) => current + 1);
                setSelected([]);
              }}
              className="rounded-lg border border-[#E4E8F1] p-2 disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </footer>
      </section>

      {bulkConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172444]/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              id="bulk-title"
              className="text-lg font-bold text-[#172444]"
            >
              Move selected products to Trash?
            </h2>

            <p className="mt-3 text-sm text-[#66748E]">
              {selected.length} products selected.
              You can restore them later.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setBulkConfirm(false)}
                className="rounded-lg border border-[#E4E8F1] px-4 py-2 text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void bulkTrash()}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Processing..." : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {purgeProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172444]/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              id="purge-title"
              className="text-lg font-bold text-red-700"
            >
              Delete permanently
            </h2>

            <p className="mt-3 text-sm text-[#66748E]">
              Type the product UUID to confirm.
              This action cannot be undone.
            </p>

            <code className="mt-3 block break-all rounded-lg bg-[#F5F6FA] p-3 text-xs">
              {purgeProduct.id}
            </code>

            <input
              type="text"
              aria-label="Confirm product UUID"
              autoComplete="off"
              value={purgeConfirm}
              onChange={(event) =>
                setPurgeConfirm(event.target.value)
              }
              className="mt-3 h-10 w-full rounded-lg border border-red-200 px-3 text-xs"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPurgeProduct(null)}
                className="rounded-lg border px-4 py-2 text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  busy ||
                  purgeConfirm.trim() !== purgeProduct.id
                }
                onClick={() =>
                  void action(purgeProduct, "permanent")
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
