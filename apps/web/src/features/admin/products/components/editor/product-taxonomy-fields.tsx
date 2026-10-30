
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Check,
  ChevronDown,
  FolderTree,
  LoaderCircle,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";

export type TaxonomyOption = {
  id: string;
  name: string;
};

export type ProductTaxonomyValue = {
  categoryIds: string[];
  tagIds: string[];
  brandId: string | null;
};

type Category = TaxonomyOption & {
  parentId: string | null;
};

type Kind = "categories" | "tags" | "brands";

type Props = {
  value: ProductTaxonomyValue;
  onChange: (value: ProductTaxonomyValue) => void;
  initialCategories?: TaxonomyOption[];
  initialTags?: TaxonomyOption[];
  initialBrand?: TaxonomyOption | null;
  disabled?: boolean;
};

type ApiResult<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type CategoryTree = {
  items: Array<
    TaxonomyOption & {
      parentId: string | null;
    }
  >;
};

type SearchResult = {
  items: TaxonomyOption[];
  pagination?: {
    totalPages?: number;
  };
};

const MAX_SELECTED = 100;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const inputClass =
  "h-10 w-full rounded-lg border border-[#E4E8F1] bg-white px-3 text-xs text-[#344362] outline-none focus:border-[#6D5DF6]";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getData<T>(
  url: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  const result = (await response.json()) as ApiResult<T>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message || "Unable to load taxonomies.",
    );
  }

  return result.data;
}

function hierarchy(categories: Category[]) {
  const all = new Map(
    categories.filter((item) => UUID.test(item.id)).map(
      (item) => [item.id, item],
    ),
  );

  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  for (const item of all.values()) {
    if (
      item.parentId &&
      item.parentId !== item.id &&
      all.has(item.parentId)
    ) {
      const list = children.get(item.parentId) ?? [];
      list.push(item);
      children.set(item.parentId, list);
    } else {
      roots.push(item);
    }
  }

  const compare = (a: Category, b: Category) =>
    a.name.localeCompare(b.name, "en");

  roots.sort(compare);

  for (const list of children.values()) {
    list.sort(compare);
  }

  const ordered: Array<{
    id: string;
    name: string;
    parentId: string | null;
    depth: number;
    path: string;
  }> = [];

  const visited = new Set<string>();

  function visit(
    item: Category,
    depth: number,
    parents: string[],
  ) {
    if (visited.has(item.id)) return;
    visited.add(item.id);

    const path = [...parents, item.name].join(" > ");

    ordered.push({
      ...item,
      depth,
      path,
    });

    for (const child of children.get(item.id) ?? []) {
      visit(child, depth + 1, [...parents, item.name]);
    }
  }

  for (const root of roots) visit(root, 0, []);

  for (const item of all.values()) {
    if (!visited.has(item.id)) visit(item, 0, []);
  }

  return ordered;
}

function QuickCreate({
  kind,
  categories,
  onCreated,
  disabled,
}: {
  kind: Kind;
  categories: Category[];
  onCreated: (item: TaxonomyOption, parentId: string | null) => void;
  disabled: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isCategory = kind === "categories";

  const title =
    kind === "categories"
      ? "Add New Category"
      : kind === "tags"
        ? "Add New Tag"
        : "Add New Brand";

  const ordered = useMemo(
    () => hierarchy(categories),
    [categories],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || disabled) return;

    const cleanName = name.trim();
    const slug = slugify(cleanName);

    if (
      cleanName.length < 2 ||
      cleanName.length > 150 ||
      slug.length < 2 ||
      slug.length > 150
    ) {
      setError("Enter a valid name (2–150 characters).");
      return;
    }

    if (isCategory && parentId && !UUID.test(parentId)) {
      setError("Invalid parent category.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/admin/product-taxonomies/create",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind,
            name: cleanName,
            slug,
            ...(isCategory
              ? { parentId: parentId || null }
              : {}),
          }),
        },
      );

      if (response.status === 401) {
        window.location.replace("/admin/login");
        throw new Error("Session expired.");
      }

      const result = (await response.json()) as ApiResult<
        TaxonomyOption & {
          parent_id?: string | null;
        }
      >;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message || "Unable to create taxonomy.",
        );
      }

      if (
        !UUID.test(result.data.id) ||
        typeof result.data.name !== "string"
      ) {
        throw new Error(
          "Created, but the server returned invalid data. Check the taxonomy list before retrying.",
        );
      }

      onCreated(
        { id: result.data.id, name: result.data.name },
        isCategory ? parentId || null : null,
      );

      setName("");
      setParentId("");
      setOpened(false);
      setSuccess(`${result.data.name} created and selected.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create taxonomy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => {
          setOpened((current) => !current);
          setError("");
          setSuccess("");
        }}
        aria-expanded={opened}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6554D8] hover:underline disabled:opacity-40"
      >
        <Plus className="size-3.5" />
        {title}
      </button>

      {success && (
        <p role="status" className="text-xs text-emerald-700">
          {success}
        </p>
      )}

      {opened && (
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-3 rounded-xl border border-[#E7E4FA] bg-[#FAF9FF] p-3"
        >
          <div>
            <label
              htmlFor={`quick-create-${kind}`}
              className="mb-1.5 block text-xs font-semibold text-[#465575]"
            >
              {isCategory
                ? "Category Name"
                : kind === "tags"
                  ? "Tag Name"
                  : "Brand Name"}
            </label>

            <input
              id={`quick-create-${kind}`}
              type="text"
              required
              minLength={2}
              maxLength={150}
              autoComplete="off"
              disabled={saving || disabled}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder={
                isCategory
                  ? "Enter category name"
                  : kind === "tags"
                    ? "Enter tag name"
                    : "Enter brand name"
              }
              className={inputClass}
            />
          </div>

          {isCategory && (
            <div>
              <label
                htmlFor="quick-create-parent"
                className="mb-1.5 block text-xs font-semibold text-[#465575]"
              >
                Parent Category
              </label>

              <select
                id="quick-create-parent"
                value={parentId}
                disabled={saving || disabled}
                onChange={(event) =>
                  setParentId(event.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  None (Top-level Category)
                </option>

                {ordered.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.path}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-[11px] text-[#8A97AC]">
                Choose a parent to create a subcategory.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={disabled || saving}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#6D5DF6] px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving && (
                <LoaderCircle className="size-3.5 animate-spin" />
              )}
              {saving ? "Creating..." : "Create & Select"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => setOpened(false)}
              className="text-xs font-semibold text-[#7A879F]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CategoryField({
  selectedIds,
  initialCategories,
  disabled,
  onChange,
}: {
  selectedIds: string[];
  initialCategories: TaxonomyOption[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || loaded) return;

    const controller = new AbortController();

    const task = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");

        try {
          const result = await getData<CategoryTree>(
            "/api/admin/products/presentation?kind=categories",
            controller.signal,
          );

          if (!Array.isArray(result.items)) {
            throw new Error("Invalid category response.");
          }

          if (!controller.signal.aborted) {
            setCategories(result.items);
            setLoaded(true);
          }
        } catch (caught) {
          if (!controller.signal.aborted) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load categories.",
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
      window.clearTimeout(task);
      controller.abort();
    };
  }, [loaded, open]);

  const ordered = useMemo(
    () => hierarchy(categories),
    [categories],
  );

  const known = useMemo(() => {
    const map = new Map(
      initialCategories.map((item) => [
        item.id,
        item.name,
      ]),
    );

    for (const item of ordered) {
      map.set(item.id, item.path);
    }

    return map;
  }, [initialCategories, ordered]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return query
      ? ordered.filter((item) =>
          item.path.toLowerCase().includes(query),
        )
      : ordered;
  }, [ordered, search]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }

    if (selectedIds.length >= MAX_SELECTED) {
      setError("Maximum 100 categories per product.");
      return;
    }

    onChange([...selectedIds, id]);
    setError("");
  }

  function onCreated(
    item: TaxonomyOption,
    parentId: string | null,
  ) {
    setCategories((previous) => [
      ...previous.filter((existing) => existing.id !== item.id),
      { ...item, parentId },
    ]);

    if (selectedIds.length < MAX_SELECTED) {
      onChange([...selectedIds, item.id]);
    }

    setLoaded(false);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold text-[#465575]">
          <FolderTree className="size-4 text-[#6D5DF6]" />
          Categories
        </p>
        <span className="text-[11px] text-[#8794AC]">
          {selectedIds.length} selected
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#F0EDFF] px-2 py-1.5 text-[11px] font-semibold text-[#6554D8]"
            >
              <span className="truncate">
                {known.get(id) ?? "Selected category"}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${known.get(id) ?? "category"}`}
                onClick={() => toggle(id)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-[#E4E8F1] px-3 text-xs font-semibold text-[#53627C] disabled:opacity-50"
      >
        Choose Categories
        <ChevronDown className="size-4" />
      </button>

      {open && (
        <div className="rounded-xl border border-[#E8EAF3] p-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9AA6B9]" />
            <input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search categories"
              placeholder="Search categories..."
              className={`${inputClass} pl-9`}
            />
          </div>

          {loading && (
            <LoaderCircle className="mx-auto my-4 size-5 animate-spin text-[#6D5DF6]" />
          )}

          {error && (
            <p role="alert" className="p-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="mt-2 max-h-64 overflow-y-auto">
            {visible.map((item) => (
              <label
                key={item.id}
                title={item.path}
                style={{
                  paddingLeft: `${Math.min(item.depth, 8) * 14 + 8}px`,
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg py-2 pr-2 text-xs text-[#465575] hover:bg-[#F7F5FF]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  className="size-4 accent-[#6D5DF6]"
                />
                <span className="truncate">{item.name}</span>
              </label>
            ))}

            {!loading && visible.length === 0 && (
              <p className="p-3 text-xs text-[#8794AC]">
                No categories found.
              </p>
            )}
          </div>
        </div>
      )}

      <QuickCreate
        kind="categories"
        categories={categories}
        disabled={disabled || selectedIds.length >= MAX_SELECTED}
        onCreated={onCreated}
      />
    </div>
  );
}

function SearchableField({
  kind,
  selectedIds,
  initialItems,
  disabled,
  onChange,
}: {
  kind: "tags" | "brands";
  selectedIds: string[];
  initialItems: TaxonomyOption[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const single = kind === "brands";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TaxonomyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [known, setKnown] = useState<Record<string, TaxonomyOption>>({});
  const [hasMore, setHasMore] = useState(false);

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
            page: String(page),
            limit: "30",
          });

          const result = await getData<SearchResult>(
            `/api/admin/catalog-filter-options?${params}`,
            controller.signal,
          );

          if (controller.signal.aborted) return;

          const next = result.items ?? [];

          setItems((previous) => {
            if (page === 1) return next;

            const map = new Map(
              previous.map((item) => [item.id, item]),
            );

            for (const item of next) map.set(item.id, item);

            return [...map.values()];
          });

          setHasMore(
            result.pagination?.totalPages !== undefined
              ? page < result.pagination.totalPages
              : next.length === 30,
          );
        } catch (caught) {
          if (!controller.signal.aborted) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to search taxonomies.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, open, search, page]);

  const names = useMemo(() => {
    const map = new Map<string, TaxonomyOption>();

    for (const item of initialItems) map.set(item.id, item);
    for (const item of items) map.set(item.id, item);
    for (const item of Object.values(known)) map.set(item.id, item);

    return map;
  }, [initialItems, items, known]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else if (single) {
      onChange([id]);
    } else if (selectedIds.length < MAX_SELECTED) {
      onChange([...selectedIds, id]);
    } else {
      setError("Maximum 100 tags per product.");
    }
  }

  function onCreated(item: TaxonomyOption) {
    setKnown((current) => ({
      ...current,
      [item.id]: item,
    }));

    setItems((current) => [
      item,
      ...current.filter((existing) => existing.id !== item.id),
    ]);

    if (single) {
      onChange([item.id]);
    } else if (selectedIds.length < MAX_SELECTED) {
      onChange([...selectedIds, item.id]);
    }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs font-bold text-[#465575]">
        <Tag className="size-4 text-[#6D5DF6]" />
        {single ? "Brand" : "Tags"}
      </p>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#F0EDFF] px-2 py-1.5 text-[11px] font-semibold text-[#6554D8]"
            >
              <span className="truncate">
                {names.get(id)?.name ?? "Selected item"}
              </span>

              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${names.get(id)?.name ?? "selection"}`}
                onClick={() => toggle(id)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-[#E4E8F1] px-3 text-xs font-semibold text-[#53627C] disabled:opacity-50"
      >
        {single ? "Choose Brand" : "Add Tags"}
        <ChevronDown className="size-4" />
      </button>

      {open && (
        <div className="rounded-xl border border-[#E8EAF3] p-2">
          <input
            type="search"
            value={search}
            maxLength={100}
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}...`}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setItems([]);
            }}
            className={inputClass}
          />

          {error && (
            <p role="alert" className="p-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="mt-2 max-h-52 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  toggle(item.id);
                  setKnown((current) => ({
                    ...current,
                    [item.id]: item,
                  }));
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#465575] hover:bg-[#F7F5FF]"
              >
                <span className="truncate">{item.name}</span>
                {selectedIds.includes(item.id) && (
                  <Check className="size-4 text-[#6D5DF6]" />
                )}
              </button>
            ))}

            {loading && (
              <LoaderCircle className="mx-auto my-4 size-4 animate-spin text-[#6D5DF6]" />
            )}

            {!loading && !error && items.length === 0 && (
              <p className="p-3 text-xs text-[#8794AC]">
                No results found.
              </p>
            )}

            {hasMore && !loading && (
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                className="w-full rounded-lg py-3 text-xs font-semibold text-[#6554D8]"
              >
                Load More
              </button>
            )}
          </div>
        </div>
      )}

      <QuickCreate
        kind={kind}
        categories={[]}
        disabled={
          disabled ||
          (!single && selectedIds.length >= MAX_SELECTED)
        }
        onCreated={onCreated}
      />
    </div>
  );
}

export function ProductTaxonomyFields({
  value,
  onChange,
  initialCategories = [],
  initialTags = [],
  initialBrand = null,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-5">
      <CategoryField
        selectedIds={value.categoryIds}
        initialCategories={initialCategories}
        disabled={disabled}
        onChange={(categoryIds) =>
          onChange({ ...value, categoryIds })
        }
      />

      <div className="border-t border-[#EDF0F6] pt-5">
        <SearchableField
          kind="tags"
          selectedIds={value.tagIds}
          initialItems={initialTags}
          disabled={disabled}
          onChange={(tagIds) =>
            onChange({ ...value, tagIds })
          }
        />
      </div>

      <div className="border-t border-[#EDF0F6] pt-5">
        <SearchableField
          kind="brands"
          selectedIds={value.brandId ? [value.brandId] : []}
          initialItems={initialBrand ? [initialBrand] : []}
          disabled={disabled}
          onChange={(ids) =>
            onChange({
              ...value,
              brandId: ids[0] ?? null,
            })
          }
        />
      </div>
    </div>
  );
}
