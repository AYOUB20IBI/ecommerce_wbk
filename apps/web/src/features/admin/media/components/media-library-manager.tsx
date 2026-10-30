
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  Check,
  Copy,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Grid2X2,
  ImageIcon,
  List,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteMedia,
  formatMediaSize,
  getMediaPreviewUrl,
  type MediaAsset,
  type MediaPage,
} from "../lib/media-api";

import {
  searchMedia,
  type MediaSearchType,
} from "../lib/media-search-api";

import {
  downloadDocument,
  getDocumentKind,
} from "../lib/media-documents-api";

import { MediaDocumentUploader } from "./media-document-uploader";
import { MediaMetadataPanel } from "./media-metadata-panel";

type Props = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type View = "grid" | "list";

function isImage(asset: MediaAsset): boolean {
  return (
    asset.mimeType?.startsWith("image/") === true ||
    (
      asset.sourceType === "external" &&
      getDocumentKind(asset) === null
    )
  );
}

function Preview({
  asset,
  className = "",
}: {
  asset: MediaAsset;
  className?: string;
}) {
  const kind = getDocumentKind(asset);

  if (kind) {
    const Icon = kind === "csv"
      ? FileSpreadsheet
      : FileText;

    return (
      <div
        className={`flex items-center justify-center bg-[#F7F8FC] ${className}`}
      >
        <Icon
          className={`size-10 ${
            kind === "pdf"
              ? "text-red-500"
              : kind === "csv"
                ? "text-emerald-600"
                : "text-blue-500"
          }`}
        />
      </div>
    );
  }

  const src = isImage(asset)
    ? getMediaPreviewUrl(asset)
    : null;

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[#F7F8FC] ${className}`}
      >
        {isImage(asset) ? (
          <ImageIcon className="size-9 text-[#A5B0C3]" />
        ) : (
          <File className="size-9 text-[#A5B0C3]" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={asset.altText || asset.originalName || "Media"}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`object-contain ${className}`}
    />
  );
}

export function MediaLibraryManager({
  canCreate,
  canUpdate,
  canDelete,
}: Props) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaSearchType>("all");
  const [view, setView] = useState<View>("grid");

  const [result, setResult] = useState<MediaPage | null>(null);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadVisible, setUploadVisible] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = input.trim();

      if (next !== search) {
        setLoading(true);
        setPage(1);
        setSearch(next);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [input, search]);

  useEffect(() => {
    const controller = new AbortController();

    void searchMedia(
      {
        page,
        limit: 24,
        search,
        type: filter,
      },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult(data);
        setError("");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;

        setResult(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load media.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, search, filter, revision]);

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function changeFilter(value: MediaSearchType) {
    if (filter === value) return;
    setLoading(true);
    setPage(1);
    setFilter(value);
  }

  function changePage(value: number) {
    if (value < 1 || value === page) return;
    setLoading(true);
    setPage(value);
  }

  function openDetails(asset: MediaAsset) {
    setSelected(asset);
    setConfirmDelete(false);
    setCopied(false);
    setError("");
    setNotice("");
  }

  function closeDetails() {
    if (deleting || downloading) return;
    setSelected(null);
    setConfirmDelete(false);
  }

  function handleUpdated(asset: MediaAsset) {
    setSelected((old) =>
      old?.id === asset.id ? { ...old, ...asset } : old,
    );

    setResult((old) => {
      if (!old) return old;

      return {
        ...old,
        items: old.items.map((item) =>
          item.id === asset.id
            ? { ...item, ...asset }
            : item,
        ),
      };
    });
  }

  async function copyUrl() {
    if (!selected?.url) return;

    try {
      await navigator.clipboard.writeText(selected.url);
      setCopied(true);
    } catch {
      setError("Unable to copy the media URL.");
    }
  }

  async function handleDownload() {
    if (!selected || !getDocumentKind(selected)) return;

    setDownloading(true);
    setError("");

    try {
      await downloadDocument(selected);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Download failed.",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!selected || !canDelete || deleting) return;

    setDeleting(true);
    setError("");
    setNotice("");

    try {
      const response = await deleteMedia(selected.id);

      setNotice(
        response.status === "deleted"
          ? "Media deleted."
          : "Media deletion requested. Cleanup may continue asynchronously.",
      );

      setSelected(null);
      setConfirmDelete(false);
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Delete request failed.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const items = result?.items ?? [];
  const selectedIsDocument =
    selected !== null && getDocumentKind(selected) !== null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#172444]">
            Media Library
          </h1>

          <p className="mt-1 text-xs text-[#8794AC]">
            Manage uploaded images and private documents.
          </p>
        </div>

        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/media/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-3 text-xs font-bold text-white"
            >
              <Plus className="size-4" />
              Add Images
            </Link>

            <button
              type="button"
              onClick={() => setUploadVisible((v) => !v)}
              aria-expanded={uploadVisible}
              className="rounded-xl border border-[#DCD8FF] bg-white px-4 py-3 text-xs font-bold text-[#6654DC]"
            >
              {uploadVisible ? "Hide Upload" : "Upload Documents"}
            </button>
          </div>
        )}
      </header>

      {canCreate && uploadVisible && (
        <MediaDocumentUploader
          onUploaded={() => {
            setPage(1);
            refresh();
          }}
        />
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A0ABC0]" />

            <input
              type="search"
              value={input}
              maxLength={150}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Search media library"
              placeholder="Search all media..."
              className="h-11 w-full rounded-xl border border-[#E4E8F1] pl-10 pr-3 text-sm outline-none focus:border-[#6D5DF6]"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All"],
                ["image", "Images"],
                ["document", "Documents"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => changeFilter(value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  filter === value
                    ? "bg-[#EEEBFF] text-[#6D5DF6]"
                    : "text-[#8090AA]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl border border-[#E6EAF3] p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid View"
              aria-pressed={view === "grid"}
              className={`rounded-lg p-2 ${
                view === "grid"
                  ? "bg-[#EEEBFF] text-[#6D5DF6]"
                  : "text-[#8090AA]"
              }`}
            >
              <Grid2X2 className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List View"
              aria-pressed={view === "list"}
              className={`rounded-lg p-2 ${
                view === "list"
                  ? "bg-[#EEEBFF] text-[#6D5DF6]"
                  : "text-[#8090AA]"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh Media"
            className="rounded-xl border border-[#E6EAF3] p-3 text-[#6D5DF6]"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <LoaderCircle className="size-7 animate-spin text-[#6D5DF6]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center">
            <ImageIcon className="size-10 text-[#B6BED0]" />
            <p className="mt-3 text-sm text-[#8794AC]">
              No media found.
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => openDetails(asset)}
                className="overflow-hidden rounded-xl border border-[#E6EAF3] text-left hover:border-[#6D5DF6]"
              >
                <Preview
                  asset={asset}
                  className="aspect-square w-full bg-[#FAFBFE]"
                />

                <div className="px-3 py-2">
                  <p className="truncate text-[11px] font-semibold text-[#465575]">
                    {asset.originalName || "External media"}
                  </p>

                  <p className="mt-1 text-[10px] text-[#8794AC]">
                    {formatMediaSize(asset.size)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[#EDF0F6]">
            {items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => openDetails(asset)}
                className="flex w-full items-center gap-4 py-3 text-left hover:bg-[#FAFBFE]"
              >
                <Preview
                  asset={asset}
                  className="size-16 shrink-0 rounded-lg"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#344362]">
                    {asset.originalName || "External media"}
                  </p>

                  <p className="mt-1 text-xs text-[#8794AC]">
                    {asset.mimeType || asset.sourceType}
                  </p>
                </div>

                <span className="text-xs text-[#8794AC]">
                  {formatMediaSize(asset.size)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[#EDF0F6] pt-5">
          <p className="text-xs text-[#8794AC]">
            {result?.total ?? 0} files · Page {page} of{" "}
            {Math.max(1, result?.totalPages ?? 1)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => changePage(page - 1)}
              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                loading ||
                page >= (result?.totalPages ?? 1)
              }
              onClick={() => changePage(page + 1)}
              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-[#14213E]/60">
          <button
            type="button"
            aria-label="Close media details"
            onClick={closeDetails}
            className="absolute inset-0"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Media Details"
            className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#172444]">
                Media Details
              </h2>

              <button
                type="button"
                disabled={deleting || downloading}
                onClick={closeDetails}
                aria-label="Close details"
              >
                <X className="size-5" />
              </button>
            </div>

            <Preview
              asset={selected}
              className="mt-5 aspect-square w-full rounded-xl"
            />

            <div className="mt-5">
              <MediaMetadataPanel
                key={selected.id}
                asset={selected}
                canUpdate={canUpdate}
                onUpdated={handleUpdated}
              />
            </div>

            {selected.url && !selectedIsDocument && (
              <div className="mt-6 space-y-3">
                <label
                  htmlFor="media-url"
                  className="text-xs font-semibold text-[#465575]"
                >
                  Media URL
                </label>

                <input
                  id="media-url"
                  readOnly
                  value={selected.url}
                  onFocus={(event) => event.target.select()}
                  className="h-11 w-full rounded-lg border border-[#E4E8F1] px-3 text-xs"
                />

                <button
                  type="button"
                  onClick={() => void copyUrl()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#6D5DF6] px-4 py-2.5 text-xs font-semibold text-white"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy URL"}
                </button>
              </div>
            )}

            {selectedIsDocument && (
              <button
                type="button"
                disabled={downloading || deleting}
                onClick={() => void handleDownload()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {downloading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {downloading
                  ? "Downloading..."
                  : "Secure Download"}
              </button>
            )}

            {canDelete && (
              <div className="mt-8 border-t border-[#EDF0F6] pt-5">
                {!confirmDelete ? (
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600"
                  >
                    <Trash2 className="size-4" />
                    Delete Media
                  </button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      Request deletion of this media?
                    </p>

                    <p className="text-xs text-red-700">
                      Storage cleanup may continue asynchronously.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void handleDelete()}
                        className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {deleting
                          ? "Deleting..."
                          : "Confirm Delete"}
                      </button>

                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
