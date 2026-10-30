
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Globe2,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

import {
  getMediaSettings,
  saveMediaSettings,
  type MediaSettings,
} from "../lib/media-settings-api";

type GroupKey =
  | "images"
  | "modernImages"
  | "documents"
  | "spreadsheets"
  | "videos"
  | "archives";

type SettingsGroup = {
  key: GroupKey;
  title: string;
  description: string;
  formats: string;
  max: number;
  icon: typeof FileImage;
  available: boolean;
};

const GROUPS: SettingsGroup[] = [
  {
    key: "images",
    title: "Standard Images",
    description: "Standard product and media images.",
    formats: "JPEG, PNG",
    max: 20,
    icon: ImageIcon,
    available: true,
  },
  {
    key: "modernImages",
    title: "Modern Images",
    description: "Modern compressed image formats.",
    formats: "WebP",
    max: 20,
    icon: FileImage,
    available: true,
  },
  {
    key: "documents",
    title: "Documents",
    description: "Private document upload policy.",
    formats: "PDF, TXT",
    max: 50,
    icon: FileText,
    available: true,
  },
  {
    key: "spreadsheets",
    title: "Spreadsheets",
    description: "Spreadsheet upload policy.",
    formats: "CSV",
    max: 50,
    icon: FileSpreadsheet,
    available: true,
  },
  {
    key: "videos",
    title: "Videos",
    description: "Reserved for future video support.",
    formats: "Not integrated",
    max: 500,
    icon: Film,
    available: false,
  },
  {
    key: "archives",
    title: "Archives",
    description: "Reserved for future archive support.",
    formats: "Not integrated",
    max: 50,
    icon: FileArchive,
    available: false,
  },
];

const effectiveCaps: Partial<Record<GroupKey, number>> = {
  images: 5,
  modernImages: 5,
  documents: 20,
  spreadsheets: 20,
};

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MediaSettingsManager() {
  const [settings, setSettings] =
    useState<MediaSettings | null>(null);

  const [saved, setSaved] =
    useState<MediaSettings | null>(null);

  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isDirty =
    settings !== null &&
    saved !== null &&
    JSON.stringify(settings) !== JSON.stringify(saved);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getMediaSettings();

      setSettings(result.configuration);
      setSaved(result.configuration);
      setUpdatedAt(result.updatedAt);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Media Settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Async work starts without synchronous state updates in the effect.
    async function initialize() {
      try {
        const result = await getMediaSettings();

        if (cancelled) return;

        setSettings(result.configuration);
        setSaved(result.configuration);
        setUpdatedAt(result.updatedAt);
        setError("");
      } catch (caught) {
        if (cancelled) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load Media Settings.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  function changeGroup(
    key: GroupKey,
    patch: Partial<MediaSettings[GroupKey]>,
  ) {
    setSuccess("");

    setSettings((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        [key]: {
          ...previous[key],
          ...patch,
        },
      };
    });
  }

  function changeExternal(
    key: "allowExternalHttp" | "allowExternalHttps",
    value: boolean,
  ) {
    setSuccess("");

    setSettings((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        [key]: value,
      };
    });
  }

  async function save() {
    if (!settings || !isDirty || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await saveMediaSettings(settings);

      setSettings(result.configuration);
      setSaved(result.configuration);
      setUpdatedAt(result.updatedAt);
      setSuccess("Media Settings saved successfully.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save Media Settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    if (saved) {
      setSettings(saved);
      setError("");
      setSuccess("");
    }
  }

  if (loading && !settings) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-3 text-sm text-[#8794AC]">
        <LoaderCircle className="size-6 animate-spin text-[#6D5DF6]" />
        Loading Media Settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8">
        <p role="alert" className="text-sm text-red-700">
          {error || "Unable to load settings."}
        </p>

        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-[#6D5DF6] px-5 py-3 text-sm font-semibold text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/media"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#6D5DF6]"
          >
            <ArrowLeft className="size-4" />
            Back to Media Library
          </Link>

          <h1 className="mt-4 text-2xl font-extrabold text-[#172444]">
            Media Settings
          </h1>

          <p className="mt-1 text-sm text-[#8794AC]">
            Configure media upload limits and external URLs.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-[#DDD9FF] bg-[#F5F3FF] px-4 py-3 text-xs font-semibold text-[#6D5DF6]">
          <ShieldCheck className="size-4" />
          Admin Only
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          <CheckCircle2 className="size-5" />
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172444]">
              Upload Policies
            </h2>

            <p className="mt-1 text-xs text-[#8794AC]">
              Enable supported file groups and configure limits.
            </p>
          </div>

          <FileImage className="size-6 text-[#6D5DF6]" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const current = settings[group.key];
            const cap = effectiveCaps[group.key];

            return (
              <div
                key={group.key}
                className="rounded-xl border border-[#E6EAF3] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[#F0EEFF] p-3">
                    <Icon className="size-5 text-[#6D5DF6]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#253655]">
                      {group.title}
                    </h3>

                    <p className="mt-1 text-xs text-[#8794AC]">
                      {group.description}
                    </p>

                    <p className="mt-2 text-[11px] font-semibold text-[#6654DC]">
                      {group.formats}
                    </p>
                  </div>

                  <label className="inline-flex shrink-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={current.enabled}
                      disabled={!group.available || saving}
                      onChange={(event) =>
                        changeGroup(group.key, {
                          enabled: event.target.checked,
                        })
                      }
                      aria-label={`Enable ${group.title}`}
                      className="size-4 accent-[#6D5DF6]"
                    />
                    <span className="text-xs text-[#465575]">
                      {current.enabled ? "On" : "Off"}
                    </span>
                  </label>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor={`limit-${group.key}`}
                    className="mb-2 block text-xs font-semibold text-[#465575]"
                  >
                    Configured Maximum File Size (MB)
                  </label>

                  <input
                    id={`limit-${group.key}`}
                    type="number"
                    min={1}
                    max={group.max}
                    step={1}
                    value={current.maxSizeMb}
                    disabled={!group.available || saving}
                    onChange={(event) => {
                      const value = Number(event.target.value);

                      if (
                        Number.isInteger(value) &&
                        value >= 1 &&
                        value <= group.max
                      ) {
                        changeGroup(group.key, {
                          maxSizeMb: value,
                        });
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 text-sm text-[#344362] outline-none focus:border-[#6D5DF6] disabled:bg-[#F7F8FC]"
                  />

                  {cap !== undefined && (
                    <p className="mt-2 text-[11px] text-[#8794AC]">
                      Current upload endpoint also enforces a
                      maximum of {cap} MB.
                    </p>
                  )}

                  {!group.available && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Upload integration not available in this release.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#F0EEFF] p-3">
            <Globe2 className="size-5 text-[#6D5DF6]" />
          </div>

          <div>
            <h2 className="text-base font-bold text-[#172444]">
              External Image URLs
            </h2>
            <p className="mt-1 text-xs text-[#8794AC]">
              Control supported external image protocols.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {(
            [
              [
                "allowExternalHttps",
                "Allow HTTPS URLs",
                "Recommended for secure external images.",
              ],
              [
                "allowExternalHttp",
                "Allow HTTP URLs",
                "Insecure HTTP URLs are not recommended.",
              ],
            ] as const
          ).map(([key, title, description]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-[#E6EAF3] p-4"
            >
              <span>
                <span className="block text-sm font-semibold text-[#344362]">
                  {title}
                </span>
                <span className="mt-1 block text-xs text-[#8794AC]">
                  {description}
                </span>
              </span>

              <input
                type="checkbox"
                checked={settings[key]}
                disabled={saving}
                onChange={(event) =>
                  changeExternal(key, event.target.checked)
                }
                className="size-4 shrink-0 accent-[#6D5DF6]"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E6EAF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#172444]">
          Settings Information
        </h2>

        <p className="mt-2 text-xs text-[#8794AC]">
          Last saved: {formatDate(updatedAt)}
        </p>

        <p className="mt-3 text-xs leading-6 text-[#8794AC]">
          These settings are validated by the NestJS API.
          Actual upload limits can also be restricted by
          the upload route, reverse proxy and file
          processing pipeline. Private document storage
          and deletion queues are managed separately.
        </p>
      </section>

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EAF3] bg-white/95 p-4 shadow-lg backdrop-blur">
        <div>
          <p className="text-xs font-semibold text-[#344362]">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </p>

          <p className="mt-1 text-[11px] text-[#8794AC]">
            Changes affect future uploads.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={resetChanges}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E8F1] px-4 py-3 text-xs font-semibold text-[#52617B] disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>

          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E8F1] px-4 py-3 text-xs font-semibold text-[#52617B] disabled:opacity-40"
          >
            <RefreshCw className="size-4" />
            Reload
          </button>

          <button
            type="button"
            disabled={!isDirty || saving || loading}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
