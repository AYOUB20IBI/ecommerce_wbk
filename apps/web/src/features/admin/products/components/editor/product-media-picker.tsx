
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  Check,
  CloudUpload,
  ImagePlus,
  Link2,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";

import {
  createExternalMedia,
  getMediaPage,
  getMediaPreviewUrl,
  normalizeMedia,
  uploadMediaFile,
  type MediaAsset as LibraryMediaAsset,
} from "@/features/admin/media/lib/media-api";

export type MediaAsset = {
  id: string;
  url: string | null;
  originalName: string | null;
  altText: string | null;
  sourceType: "upload" | "external";
  createdAt: string;
};

type Props = {
  open: boolean;
  multiple: boolean;
  selectedIds: string[];
  onSelect: (assets: MediaAsset[]) => void;
  onClose: () => void;
};

type Tab = "library" | "upload" | "external";

function toPickerAsset(
  asset: LibraryMediaAsset,
): MediaAsset {
  const normalized = normalizeMedia(asset);

  return {
    id: normalized.id,
    url: normalized.url,
    originalName: normalized.originalName,
    altText: normalized.altText,
    sourceType:
      normalized.sourceType === "external"
        ? "external"
        : "upload",
    createdAt: normalized.createdAt ?? "",
  };
}

export function ProductMediaPicker({
  open,
  multiple,
  selectedIds,
  onSelect,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("library");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<MediaAsset[]>([]);
  const [externalUrl, setExternalUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || tab !== "library") return;

    const controller = new AbortController();

    const run = async () => {
      try {
        const result = await getMediaPage(
          page,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setItems(result.items.map(toPickerAsset));
        setTotalPages(result.totalPages);
        setError("");
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load media.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(
      () => void run(),
      0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, page, tab]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const filtered = items.filter((item) =>
    [item.originalName, item.altText, item.url]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  function toggle(asset: MediaAsset) {
    setChosen((previous) => {
      if (previous.some((item) => item.id === asset.id)) {
        return previous.filter((item) => item.id !== asset.id);
      }

      return multiple
        ? [...previous, asset]
        : [asset];
    });
  }

  function confirm() {
    if (chosen.length === 0) return;

    onSelect(chosen);
    setChosen([]);
    onClose();
  }

  async function upload(files: FileList | null) {
    if (!files || busy || files.length === 0) return;

    setBusy(true);
    setError("");

    const created: MediaAsset[] = [];

    try {
      for (const file of Array.from(files)) {
        const result = await uploadMediaFile(file);
        created.push(toPickerAsset(result));
      }

      if (created.length > 0) {
        onSelect(multiple ? created : [created[0]]);
        onClose();
      }
    } catch (caught) {
      if (created.length > 0) {
        onSelect(multiple ? created : [created[0]]);
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Upload failed.",
      );
    } finally {
      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function addExternal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const asset = toPickerAsset(
        await createExternalMedia(
          externalUrl,
          altText,
        ),
      );

      onSelect([asset]);
      setExternalUrl("");
      setAltText("");
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to add external image.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#121A32]/70 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#E9ECF4] px-5 py-4">
          <div>
            <h2
              id="media-picker-title"
              className="text-lg font-bold text-[#172444]"
            >
              {multiple
                ? "Select Gallery Images"
                : "Set Product Thumbnail"}
            </h2>
            <p className="mt-1 text-xs text-[#8491AA]">
              Upload or reuse images before saving the product.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close media picker"
            className="rounded-lg p-2 hover:bg-[#F4F5FA]"
          >
            <X className="size-5" />
          </button>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-[#E9ECF4] px-5 py-3">
          {(
            [
              ["library", "Media Library"],
              ["upload", "Upload Files"],
              ["external", "External URL"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setError("");
              }}
              className={`rounded-lg px-4 py-2 text-xs font-bold ${
                tab === key
                  ? "bg-[#6D5DF6] text-white"
                  : "bg-[#F4F5FA] text-[#52617B]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {error}
            </p>
          )}

          {tab === "library" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9BA7BB]" />

                <input
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Filter loaded media..."
                  aria-label="Filter loaded media"
                  className="h-11 w-full rounded-xl border border-[#E4E8F1] pl-10 pr-3 text-sm outline-none"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <LoaderCircle className="size-7 animate-spin text-[#6D5DF6]" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {filtered.map((asset) => {
                    const chosenNow = chosen.some(
                      (item) => item.id === asset.id,
                    );

                    const preview = getMediaPreviewUrl(asset);

                    return (
                      <button
                        type="button"
                        key={asset.id}
                        aria-pressed={chosenNow}
                        onClick={() => toggle(asset)}
                        className={`relative overflow-hidden rounded-xl border-2 text-left ${
                          chosenNow
                            ? "border-[#6D5DF6]"
                            : "border-[#E9ECF4]"
                        }`}
                      >
                        <div className="aspect-square bg-[#F5F6FA]">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt={
                                asset.altText ||
                                asset.originalName ||
                                "Media image"
                              }
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImagePlus className="size-7 text-[#A2ADC1]" />
                            </div>
                          )}
                        </div>

                        <p className="truncate px-2 py-1.5 text-[10px] text-[#53627D]">
                          {asset.originalName || "External image"}
                        </p>

                        {(chosenNow ||
                          selectedIds.includes(asset.id)) && (
                          <span className="absolute right-1 top-1 rounded-full bg-[#6D5DF6] p-1 text-white">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#EBEDF5] pt-4">
                <span className="text-xs text-[#8491AA]">
                  Page {page} of {totalPages}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => value - 1);
                    }}
                    className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => value + 1);
                    }}
                    className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[#8491AA]">
                Search filters the current page only.
              </p>
            </div>
          )}

          {tab === "upload" && (
            <div className="rounded-xl border-2 border-dashed border-[#C6C1F8] bg-[#FAF9FF] p-8 text-center">
              <CloudUpload className="mx-auto size-12 text-[#6D5DF6]" />

              <p className="mt-4 font-semibold text-[#172444]">
                Upload Product Images
              </p>

              <p className="mt-2 text-xs text-[#8794AC]">
                JPEG, PNG, WebP · Up to 5 MB per image
              </p>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple={multiple}
                disabled={busy}
                onChange={(event) =>
                  void upload(event.target.files)
                }
                className="mt-5 block w-full text-xs"
              />

              {busy && (
                <p className="mt-4 flex items-center justify-center gap-2 text-xs">
                  <LoaderCircle className="size-4 animate-spin" />
                  Uploading...
                </p>
              )}
            </div>
          )}

          {tab === "external" && (
            <form
              onSubmit={(event) => void addExternal(event)}
              className="mx-auto max-w-xl space-y-4"
            >
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#465575]">
                  External HTTP or HTTPS Image URL
                </span>

                <input
                  type="url"
                  required
                  maxLength={2048}
                  value={externalUrl}
                  onChange={(event) =>
                    setExternalUrl(event.target.value)
                  }
                  placeholder="http://example.org/image.jpg"
                  className="h-11 w-full rounded-xl border border-[#E4E8F1] px-3 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#465575]">
                  Alt Text (Optional)
                </span>

                <input
                  type="text"
                  maxLength={255}
                  value={altText}
                  onChange={(event) =>
                    setAltText(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E4E8F1] px-3 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                <Link2 className="size-4" />
                Add External Image
              </button>
            </form>
          )}
        </div>

        {tab === "library" && (
          <footer className="flex items-center justify-between border-t border-[#E9ECF4] px-5 py-4">
            <span className="text-xs text-[#8491AA]">
              {chosen.length} selected
            </span>

            <button
              type="button"
              disabled={chosen.length === 0 || busy}
              onClick={confirm}
              className="rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {multiple ? "Add to Gallery" : "Set Thumbnail"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
