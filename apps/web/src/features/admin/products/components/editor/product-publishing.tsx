"use client";

import type { ReactNode } from "react";
import {
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";

export type PublishingStatus =
  | "draft"
  | "published"
  | "private"
  | "archived";

type Props = {
  status: PublishingStatus;
  onStatusChange: (status: PublishingStatus) => void;
  featured: boolean;
  onFeaturedChange: (featured: boolean) => void;
  editing: boolean;
  saving: boolean;
  disabled: boolean;
  dirty: boolean;
  onSaveDraft: () => void;
  onSave: () => void;
};

const STATUS_CONFIG: Record<
  PublishingStatus,
  {
    title: string;
    description: string;
    icon: ReactNode;
    className: string;
  }
> = {
  draft: {
    title: "Draft",
    description: "Not publicly visible",
    icon: <FileText className="size-4" />,
    className: "bg-amber-50 text-amber-700",
  },
  published: {
    title: "Published",
    description: "Visible in the storefront",
    icon: <CheckCircle2 className="size-4" />,
    className: "bg-emerald-50 text-emerald-700",
  },
  private: {
    title: "Private",
    description: "Not publicly listed",
    icon: <EyeOff className="size-4" />,
    className: "bg-violet-50 text-violet-700",
  },
  archived: {
    title: "Archived",
    description: "Removed from the active catalog",
    icon: <Archive className="size-4" />,
    className: "bg-slate-100 text-slate-700",
  },
};

export function ProductPublishing({
  status,
  onStatusChange,
  featured,
  onFeaturedChange,
  editing,
  saving,
  disabled,
  dirty,
  onSaveDraft,
  onSave,
}: Props) {
  const configuration = STATUS_CONFIG[status];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E6EAF3] bg-white shadow-sm">
      <div className="border-b border-[#EDF0F6] px-5 py-4">
        <h2 className="text-sm font-bold text-[#172444]">
          Publish
        </h2>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${configuration.className}`}
          >
            {configuration.icon}
            {configuration.title}
          </span>

          {editing && (
            <span className="text-[11px] text-[#8290AC]">
              {dirty ? "Unsaved changes" : "Ready"}
            </span>
          )}
        </div>

        <p className="text-xs leading-5 text-[#8290AC]">
          {configuration.description}
        </p>

        <div>
          <label
            htmlFor="product-status"
            className="mb-2 block text-xs font-semibold text-[#465575]"
          >
            Product Status
          </label>

          <select
            id="product-status"
            value={status}
            onChange={(event) =>
              onStatusChange(
                event.target.value as PublishingStatus,
              )
            }
            disabled={saving || disabled}
            className="h-11 w-full rounded-xl border border-[#E4E8F1] bg-white px-3 text-sm text-[#293955] outline-none focus:border-[#6D5DF6] disabled:opacity-50"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="private">Private</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F7F5FF] p-3 text-xs font-semibold text-[#465575]">
          <input
            type="checkbox"
            checked={featured}
            disabled={saving || disabled}
            onChange={(event) =>
              onFeaturedChange(event.target.checked)
            }
            className="size-4 accent-[#6D5DF6]"
          />
          <Eye className="size-4 text-[#6D5DF6]" />
          Featured Product
        </label>

        <div className="space-y-2 border-t border-[#EDF0F6] pt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || disabled}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-4 text-xs font-bold text-white transition hover:bg-[#5948DF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}

            {saving
              ? "Saving..."
              : editing
                ? "Update Product"
                : status === "published"
                  ? "Publish Product"
                  : "Create Product"}
          </button>

          {status !== "draft" && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={saving || disabled}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#E1E5EF] bg-white px-4 text-xs font-semibold text-[#465575] hover:bg-[#F8F9FC] disabled:opacity-50"
            >
              <FileText className="size-4" />
              Save as Draft
            </button>
          )}
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-5 text-[#8290AC]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Changes are validated and authorized by the server
          before saving.
        </p>
      </div>
    </section>
  );
}