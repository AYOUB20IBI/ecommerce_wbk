
"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import Link from "next/link";

import {
  Check,
  CloudUpload,
  Copy,
  ImagePlus,
  Link2,
  LoaderCircle,
} from "lucide-react";

import {
  createExternalMedia,
  formatMediaSize,
  getMediaPreviewUrl,
  uploadMediaFile,
  type MediaAsset,
} from "../lib/media-api";

type Props = {
  canRead: boolean;
};

const MAX_FILES = 20;

export function MediaUploader({ canRead }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"upload" | "external">("upload");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<MediaAsset[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    if (busy || files.length === 0) return;

    if (files.length > MAX_FILES) {
      setError(`Select up to ${MAX_FILES} files at a time.`);
      return;
    }

    setBusy(true);
    setError("");

    const failures: string[] = [];

    try {
      for (const file of files) {
        try {
          const asset = await uploadMediaFile(file);

          setUploaded((current) => [
            asset,
            ...current.filter((item) => item.id !== asset.id),
          ]);
        } catch (caught) {
          failures.push(
            `${file.name}: ${
              caught instanceof Error
                ? caught.message
                : "Upload failed."
            }`,
          );
        }
      }

      if (failures.length > 0) {
        setError(failures.join(" "));
      }
    } finally {
      setBusy(false);
    }
  }

  function onFilesChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (!busy) {
      void uploadFiles(Array.from(event.dataTransfer.files));
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
      const asset = await createExternalMedia(
        externalUrl,
        altText,
      );

      setUploaded((current) => [
        asset,
        ...current.filter((item) => item.id !== asset.id),
      ]);

      setExternalUrl("");
      setAltText("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create external media.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(asset: MediaAsset) {
    if (!asset.url) return;

    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
    } catch {
      setError(
        "Unable to copy automatically. Select the URL and copy it manually.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#E6EAF3] bg-white shadow-sm">
        <div className="flex gap-2 border-b border-[#EDF0F6] p-4">
          <button
            type="button"
            onClick={() => {
              setTab("upload");
              setError("");
            }}
            className={`rounded-lg px-4 py-2.5 text-xs font-bold ${
              tab === "upload"
                ? "bg-[#6D5DF6] text-white"
                : "bg-[#F4F5FA] text-[#53627D]"
            }`}
          >
            Upload Files
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("external");
              setError("");
            }}
            className={`rounded-lg px-4 py-2.5 text-xs font-bold ${
              tab === "external"
                ? "bg-[#6D5DF6] text-white"
                : "bg-[#F4F5FA] text-[#53627D]"
            }`}
          >
            External Image URL
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-700"
            >
              {error}
            </div>
          )}

          {tab === "upload" ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
                dragging
                  ? "border-[#6D5DF6] bg-[#F1EEFF]"
                  : "border-[#D8D8EF] bg-[#FAFBFF]"
              }`}
            >
              <CloudUpload className="mx-auto size-14 text-[#6D5DF6]" />

              <h2 className="mt-4 text-lg font-bold text-[#172444]">
                Drop files to upload
              </h2>

              <p className="mt-2 text-sm text-[#8794AC]">
                Or select images from your computer.
              </p>

              <p className="mt-3 text-xs text-[#8794AC]">
                JPEG, PNG, WebP · Maximum 5 MB per image ·
                Up to 20 files per batch
              </p>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={onFilesChange}
                className="sr-only"
                aria-label="Select image files"
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {busy ? "Uploading..." : "Select Files"}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => void addExternal(event)}
              className="mx-auto max-w-2xl space-y-5 py-6"
            >
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#465575]">
                  External HTTP or HTTPS Image URL
                </span>

                <input
                  type="url"
                  required
                  maxLength={2048}
                  disabled={busy}
                  value={externalUrl}
                  onChange={(event) =>
                    setExternalUrl(event.target.value)
                  }
                  placeholder="http://example.org/product.jpg"
                  className="h-11 w-full rounded-xl border border-[#E4E8F1] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#465575]">
                  Alt Text (Optional)
                </span>

                <input
                  type="text"
                  maxLength={255}
                  disabled={busy}
                  value={altText}
                  onChange={(event) =>
                    setAltText(event.target.value)
                  }
                  placeholder="Describe the image"
                  className="h-11 w-full rounded-xl border border-[#E4E8F1] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                />
              </label>

              <p className="text-xs leading-5 text-[#8794AC]">
                Public HTTP and HTTPS image URLs are accepted.
                Local and private network hosts remain restricted.
              </p>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Add External Image
              </button>
            </form>
          )}
        </div>
      </section>

      {uploaded.length > 0 && (
        <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#172444]">
              Added Media ({uploaded.length})
            </h2>

            {canRead && (
              <Link
                href="/admin/media"
                className="text-xs font-semibold text-[#6D5DF6] hover:underline"
              >
                Open Media Library
              </Link>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uploaded.map((asset) => {
              const preview = getMediaPreviewUrl(asset);

              return (
                <div
                  key={asset.id}
                  className="overflow-hidden rounded-xl border border-[#E6EAF3]"
                >
                  <div className="flex aspect-video items-center justify-center bg-[#F7F8FC]">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={asset.altText || "Media image"}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="size-8 text-[#A0ACC1]" />
                    )}
                  </div>

                  <div className="space-y-2 p-4">
                    <p className="truncate text-xs font-bold text-[#465575]">
                      {asset.originalName || "External image"}
                    </p>

                    <p className="text-[11px] text-[#8794AC]">
                      {formatMediaSize(asset.size)}
                    </p>

                    {asset.url ? (
                      <>
                        <input
                          aria-label="Media URL"
                          value={asset.url}
                          readOnly
                          onFocus={(event) => event.target.select()}
                          className="h-10 w-full rounded-lg border border-[#E4E8F1] px-2 text-[11px]"
                        />

                        <button
                          type="button"
                          onClick={() => void copyUrl(asset)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#E4E8F1] px-3 py-2 text-xs font-semibold text-[#6554D8]"
                        >
                          {copiedId === asset.id ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                          {copiedId === asset.id
                            ? "Copied"
                            : "Copy URL"}
                        </button>
                      </>
                    ) : (
                      <p className="text-[11px] text-[#8794AC]">
                        A public URL was not returned.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
