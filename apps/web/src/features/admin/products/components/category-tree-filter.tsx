
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  FolderTree,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
};

type TreeItem = Category & {
  depth: number;
  path: string;
};

type ResponseBody = {
  success: boolean;
  data?: {
    items: Category[];
  };
  message?: string;
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

function buildTree(categories: Category[]): TreeItem[] {
  const byParent = new Map<string, Category[]>();
  const byId = new Map(categories.map((item) => [item.id, item]));

  for (const item of categories) {
    const key = item.parentId && byId.has(item.parentId)
      ? item.parentId
      : "";

    const children = byParent.get(key) ?? [];
    children.push(item);
    byParent.set(key, children);
  }

  const sort = (items: Category[]) =>
    items.sort((a, b) =>
      a.name.localeCompare(b.name, "fr", {
        sensitivity: "base",
      }),
    );

  for (const items of byParent.values()) {
    sort(items);
  }

  const result: TreeItem[] = [];
  const visited = new Set<string>();

  function visit(
    item: Category,
    depth: number,
    parents: string[],
  ) {
    if (visited.has(item.id)) return;

    visited.add(item.id);

    const path = [...parents, item.name].join(" > ");

    result.push({
      ...item,
      depth,
      path,
    });

    const children = byParent.get(item.id) ?? [];

    for (const child of children) {
      visit(child, depth + 1, [...parents, item.name]);
    }
  }

  for (const root of byParent.get("") ?? []) {
    visit(root, 0, []);
  }

  // Protect display against inconsistent legacy cycles.
  for (const item of categories) {
    if (!visited.has(item.id)) {
      visit(item, 0, []);
    }
  }

  return result;
}

export function CategoryTreeFilter({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || loaded) return;

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");

        try {
          const response = await fetch(
            "/api/admin/products/presentation?kind=categories",
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            },
          );

          if (response.status === 401) {
            window.location.replace("/admin/login");
            return;
          }

          const body =
            (await response.json()) as ResponseBody;

          if (
            !response.ok ||
            !body.success ||
            !Array.isArray(body.data?.items)
          ) {
            throw new Error(
              body.message ?? "Unable to load categories.",
            );
          }

          if (!controller.signal.aborted) {
            setCategories(body.data.items);
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
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, loaded]);

  const tree = useMemo(
    () => buildTree(categories),
    [categories],
  );

  const selected = tree.find(
    (item) => item.id === value,
  );

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();

    if (!term) return tree;

    // Searching parent names also shows descendants.
    return tree.filter((item) =>
      item.path.toLocaleLowerCase().includes(term),
    );
  }, [tree, search]);

  function choose(id: string) {
    onChange(id);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <div className="flex h-10 items-center rounded-lg border border-[#E4E8F1] bg-white">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 px-3 text-left text-xs text-[#344362] disabled:opacity-50"
        >
          <span className="truncate">
            {selected?.path ?? "All categories"}
          </span>

          <ChevronDown className="size-3.5 shrink-0" />
        </button>

        {value && (
          <button
            type="button"
            aria-label="Clear category filter"
            onClick={() => choose("")}
            className="px-2 text-[#8C97AD]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-[min(360px,85vw)] rounded-xl border border-[#E2E6F0] bg-white p-2 shadow-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#9DA7BA]" />

            <input
              autoFocus
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search categories..."
              className="h-10 w-full rounded-lg border border-[#E5E8F2] pl-9 pr-3 text-xs outline-none focus:border-[#6D5DF6]"
            />
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => choose("")}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                !value
                  ? "bg-[#EEEAFE] font-bold text-[#6554D8]"
                  : "text-[#66748E] hover:bg-[#F7F6FD]"
              }`}
            >
              All categories
            </button>

            {loading && (
              <div className="flex justify-center p-5">
                <LoaderCircle className="size-5 animate-spin text-[#6D5DF6]" />
              </div>
            )}

            {error && (
              <p className="px-3 py-3 text-xs text-red-600">
                {error}
              </p>
            )}

            {!loading &&
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item.id)}
                  title={item.path}
                  aria-label={item.path}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-xs transition hover:bg-[#F5F3FF] ${
                    value === item.id
                      ? "bg-[#EEEAFE] font-bold text-[#6554D8]"
                      : item.depth === 0
                        ? "font-semibold text-[#293955]"
                        : "text-[#65738E]"
                  }`}
                  style={{
                    paddingLeft: `${12 + Math.min(item.depth, 8) * 18}px`,
                  }}
                >
                  {item.depth === 0 ? (
                    <FolderTree className="size-3.5 shrink-0 text-[#8E80E9]" />
                  ) : (
                    <span className="shrink-0 text-[#A2ACC0]">
                      ↳
                    </span>
                  )}

                  <span className="truncate">
                    {item.name}
                  </span>
                </button>
              ))}

            {!loading && !error && visible.length === 0 && (
              <p className="p-4 text-center text-xs text-[#8B96AB]">
                No categories found.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
