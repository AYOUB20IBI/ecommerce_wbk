
"use client";

import { useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Star,
  Trash2,
} from "lucide-react";

import { getMediaPreviewUrl } from "@/features/admin/media/lib/media-api";

import {
  ProductMediaPicker,
  type MediaAsset,
} from "./product-media-picker";

export type ProductImageSelection = {
  thumbnail: MediaAsset | null;
  gallery: MediaAsset[];
};

export const EMPTY_PRODUCT_IMAGES: ProductImageSelection = {
  thumbnail: null,
  gallery: [],
};

type Props = {
  value: ProductImageSelection;
  onChange: (next: ProductImageSelection) => void;
  disabled?: boolean;
};

function MediaPreview({
  asset,
}: {
  asset: MediaAsset;
}) {
  const src = getMediaPreviewUrl(asset);

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F5F6FA]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={
            asset.altText ||
            asset.originalName ||
            "Product image"
          }
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImagePlus className="size-8 text-[#9AA6BA]" />
        </div>
      )}
    </div>
  );
}

export function ProductThumbnailField({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  function select(assets: MediaAsset[]) {
    const asset = assets[0];

    if (!asset) {
      return;
    }

    onChange({
      thumbnail: asset,
      gallery: value.gallery.filter(
        (item) => item.id !== asset.id,
      ),
    });
  }

  return (
    <section className="space-y-3">
      {value.thumbnail ? (
        <>
          <MediaPreview asset={value.thumbnail} />

          <p className="truncate text-xs text-[#8794AC]">
            {value.thumbnail.originalName || "External image"}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen(true)}
              className="rounded-lg border border-[#E4E8F1] px-3 py-2 text-xs font-semibold text-[#6554D8] disabled:opacity-40"
            >
              Replace Thumbnail
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  thumbnail: null,
                })
              }
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#DDDFF0] bg-[#FAFBFE] p-4 text-center hover:border-[#6D5DF6] disabled:opacity-40"
        >
          <Star className="size-8 text-[#6D5DF6]" />

          <span className="text-xs font-bold text-[#465575]">
            Set Product Thumbnail
          </span>

          <span className="text-[11px] text-[#8794AC]">
            Upload · Media Library · External URL
          </span>
        </button>
      )}

      <ProductMediaPicker
        open={open}
        multiple={false}
        selectedIds={[
          ...(value.thumbnail ? [value.thumbnail.id] : []),
          ...value.gallery.map((item) => item.id),
        ]}
        onSelect={select}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}

export function ProductGalleryField({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  function select(assets: MediaAsset[]) {
    const existing = new Set(
      value.gallery.map((item) => item.id),
    );

    const additions = assets.filter(
      (item) =>
        item.id !== value.thumbnail?.id &&
        !existing.has(item.id),
    );

    onChange({
      ...value,
      gallery: [...value.gallery, ...additions],
    });
  }

  function remove(id: string) {
    onChange({
      ...value,
      gallery: value.gallery.filter(
        (item) => item.id !== id,
      ),
    });
  }

  function move(index: number, offset: number) {
    const target = index + offset;

    if (
      target < 0 ||
      target >= value.gallery.length
    ) {
      return;
    }

    const next = [...value.gallery];

    [next[index], next[target]] = [
      next[target],
      next[index],
    ];

    onChange({
      ...value,
      gallery: next,
    });
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {value.gallery.map((asset, index) => (
          <div
            key={asset.id}
            className="overflow-hidden rounded-xl border border-[#E5E8F1]"
          >
            <MediaPreview asset={asset} />

            <div className="flex items-center justify-between gap-1 p-1.5">
              <button
                type="button"
                title="Move Left"
                aria-label={`Move image ${index + 1} left`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="rounded p-1 text-[#6554D8] disabled:opacity-30"
              >
                <ArrowLeft className="size-4" />
              </button>

              <span className="text-[10px] text-[#8794AC]">
                {index + 1}
              </span>

              <button
                type="button"
                title="Move Right"
                aria-label={`Move image ${index + 1} right`}
                disabled={
                  disabled ||
                  index === value.gallery.length - 1
                }
                onClick={() => move(index, 1)}
                className="rounded p-1 text-[#6554D8] disabled:opacity-30"
              >
                <ArrowRight className="size-4" />
              </button>

              <button
                type="button"
                title="Remove"
                aria-label={`Remove image ${index + 1}`}
                disabled={disabled}
                onClick={() => remove(asset.id)}
                className="rounded p-1 text-red-600 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#DDDFF0] bg-[#FAFBFE] p-3 text-center hover:border-[#6D5DF6] disabled:opacity-40"
        >
          <ImagePlus className="size-7 text-[#6D5DF6]" />

          <span className="text-xs font-semibold text-[#53627C]">
            Add Gallery Images
          </span>
        </button>
      </div>

      <p className="text-[11px] text-[#8794AC]">
        Add multiple images. Use arrows to change their
        order. Changes are saved with the product.
      </p>

      <ProductMediaPicker
        open={open}
        multiple
        selectedIds={[
          ...(value.thumbnail ? [value.thumbnail.id] : []),
          ...value.gallery.map((item) => item.id),
        ]}
        onSelect={select}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
