
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Activity,
  Check,
  FileText,
  LoaderCircle,
  Save,
  UserRound,
  ExternalLink 
} from "lucide-react";

import {
  getMediaActivity,
  getMediaDetails,
  updateMediaAltText,
  type MediaActivity,
  type MediaDetails,
} from "../lib/media-metadata-api";

import {
  formatMediaSize,
  type MediaAsset,
} from "../lib/media-api";
import Link from "next/link";

type Props = {
  asset: MediaAsset;
  canUpdate: boolean;
  onUpdated: (asset: MediaAsset) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function auditDescription(event: MediaActivity): string {
  if (event.action === "media.updated") {
    return "Media metadata updated";
  }

  if (event.action.includes("delet")) {
    return "Media deletion activity";
  }

  if (event.action.includes("upload")) {
    return "Media uploaded";
  }

  return event.action.replaceAll(".", " ");
}

export function MediaMetadataPanel({
  asset,
  canUpdate,
  onUpdated,
}: Props) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [activities, setActivities] = useState<MediaActivity[]>([]);
  const [altText, setAltText] = useState(asset.altText ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [media, history] = await Promise.all([
          getMediaDetails(asset.id, controller.signal),
          getMediaActivity(asset.id, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setDetails(media);
        setActivities(history);
        setAltText(media.altText ?? "");
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load media details.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [asset.id]);

  async function save() {
    if (!canUpdate || saving || !details) return;

    const value = altText.trim();

    if (value.length > 255) {
      setError("Alt text cannot exceed 255 characters.");
      return;
    }

    if ((details.altText ?? "") === value) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await updateMediaAltText(
        asset.id,
        value.length > 0 ? value : null,
      );

      setDetails(updated);
      setAltText(updated.altText ?? "");
      onUpdated(updated);
      setNotice("Alt text updated successfully.");

      try {
        setActivities(await getMediaActivity(asset.id));
      } catch {
        setNotice(
          "Alt text saved. Refresh details to reload activity.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Update failed. Refresh details before retrying.",
      );
    } finally {
      setSaving(false);
    }
  }

  const current = details ?? asset;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-[#8794AC]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading metadata...
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"
            >
              <Check className="size-4" />
              {notice}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[#6D5DF6]" />
              <h3 className="text-sm font-bold text-[#172444]">
                Media Metadata
              </h3>
            </div>

            {[
              ["Filename", current.originalName ?? "—"],
              ["MIME Type", current.mimeType ?? "—"],
              ["File Size", formatMediaSize(current.size)],
              [
                "Dimensions",
                details?.width && details?.height
                  ? `${details.width} × ${details.height} px`
                  : "—",
              ],
              ["Created", formatDate(current.createdAt)],
              ["Updated", formatDate(details?.updatedAt ?? null)],
              ["Media ID", asset.id],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-[#EEF0F6] pb-2"
              >
                <p className="text-[11px] text-[#8794AC]">
                  {label}
                </p>
                <p className="mt-1 break-all text-xs font-medium text-[#344362]">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <label
              htmlFor="media-alt-text"
              className="block text-sm font-bold text-[#172444]"
            >
              Alternative Text
            </label>

            {canUpdate ? (
              <>
                <textarea
                  id="media-alt-text"
                  value={altText}
                  maxLength={255}
                  rows={3}
                  onChange={(event) =>
                    setAltText(event.target.value)
                  }
                  className="w-full resize-y rounded-xl border border-[#E4E8F1] bg-white p-3 text-xs text-[#344362] outline-none focus:border-[#6D5DF6]"
                  placeholder="Describe this media..."
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#8794AC]">
                    {altText.length}/255
                  </span>

                  <button
                    type="button"
                    disabled={
                      saving ||
                      !details ||
                      altText.trim() === (details.altText ?? "")
                    }
                    onClick={() => void save()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#6D5DF6] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {saving ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-[#F7F8FC] p-3 text-xs text-[#52617B]">
                {details?.altText || "No alt text set."}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-[#6D5DF6]" />
              <h3 className="text-sm font-bold text-[#172444]">
                Ownership
              </h3>
            </div>

            <p className="break-all text-xs text-[#52617B]">
              Uploaded by: {details?.uploadedBy ?? "Unknown"}
            </p>

            <p className="break-all text-xs text-[#52617B]">
              Last updated by: {details?.updatedBy ?? "—"}
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[#6D5DF6]" />
              <h3 className="text-sm font-bold text-[#172444]">
                Activity History
              </h3>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-[#8794AC]">
                No activity records available.
              </p>
            ) : (
              <ol className="space-y-3">
                {activities.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border border-[#E8EBF3] bg-[#FAFBFE] p-3"
                  >
                    <p className="text-xs font-bold text-[#344362]">
                      {auditDescription(event)}
                    </p>

                    <p className="mt-1 text-[11px] text-[#8794AC]">
                      {formatDate(event.createdAt)}
                    </p>

                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EEEBFF]">
                        <UserRound className="size-3.5 text-[#6D5DF6]" />
                      </div>

                      {event.actorId ? (
                        <Link
                          href={`/admin/users/${encodeURIComponent(event.actorId)}`}
                          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#6D5DF6] hover:underline"
                          title={`View ${event.actorName}`}
                        >
                          <span className="truncate">
                            {event.actorName}
                          </span>
                          <ExternalLink className="size-3 shrink-0" />
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-[#8794AC]">
                          System
                        </span>
                      )}
                    </div>

                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
