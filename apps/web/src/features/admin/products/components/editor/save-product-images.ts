
import type {
  MediaAsset,
} from "./product-media-picker";

import type {
  ProductImageSelection,
} from "./product-image-fields";

type GalleryRow = {
  id: string;
  media_id: string;
  is_featured: boolean;
  position: number;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  let body: ApiResponse<T>;

  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("Invalid image API response.");
  }

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  if (!response.ok || body.success !== true) {
    throw new Error(
      body.message || "Unable to synchronize product images.",
    );
  }

  if (body.data === undefined) {
    throw new Error("Missing image API data.");
  }

  return body.data;
}

function endpoint(productId: string): string {
  if (!UUID.test(productId)) {
    throw new Error("Invalid product ID.");
  }

  return `/api/admin/product-media/${encodeURIComponent(productId)}`;
}

function validateRows(rows: unknown): asserts rows is GalleryRow[] {
  if (
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        typeof row !== "object" ||
        row === null ||
        !UUID.test(row.id) ||
        !UUID.test(row.media_id) ||
        typeof row.is_featured !== "boolean" ||
        !Number.isSafeInteger(row.position),
    )
  ) {
    throw new Error("Invalid product gallery response.");
  }
}

async function getRows(productId: string): Promise<GalleryRow[]> {
  const rows = await api<GalleryRow[]>(endpoint(productId));
  validateRows(rows);
  return rows;
}

export async function loadProductImages(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductImageSelection> {
  const rows = await api<GalleryRow[]>(
    endpoint(productId),
    { signal },
  );

  validateRows(rows);

  const sorted = [...rows].sort(
    (a, b) => a.position - b.position,
  );

  // Backend gallery rows do not contain resolved storage URLs.
  // Media Details provides the actual URL for uploads and
  // external assets. Fetch in parallel.
  const assets = await Promise.all(
    sorted.map((row) =>
      api<MediaAsset>(
        `/api/admin/media-library?id=${encodeURIComponent(row.media_id)}`,
        { signal },
      ),
    ),
  );

  if (
    assets.some(
      (asset, index) =>
        !asset ||
        asset.id !== sorted[index].media_id,
    )
  ) {
    throw new Error("Unable to resolve gallery media.");
  }

  let thumbnail: MediaAsset | null = null;
  const gallery: MediaAsset[] = [];

  sorted.forEach((row, index) => {
    if (row.is_featured && thumbnail === null) {
      thumbnail = assets[index];
    } else {
      gallery.push(assets[index]);
    }
  });

  return { thumbnail, gallery };
}

export function imageSelectionSignature(
  value: ProductImageSelection,
): string {
  return JSON.stringify({
    thumbnail: value.thumbnail?.id ?? null,
    gallery: value.gallery.map((item) => item.id),
  });
}

export function validateProductImages(
  value: ProductImageSelection,
): void {
  const assets = [
    ...(value.thumbnail ? [value.thumbnail] : []),
    ...value.gallery,
  ];

  if (assets.length > 1000) {
    throw new Error("Too many product images.");
  }

  const ids = assets.map((asset) => asset.id);

  if (
    ids.some((id) => !UUID.test(id)) ||
    ids.length !== new Set(ids).size
  ) {
    throw new Error("Invalid or duplicate media selection.");
  }
}

export async function synchronizeProductImages(
  productId: string,
  selection: ProductImageSelection,
): Promise<void> {
  validateProductImages(selection);

  const url = endpoint(productId);
  const desired = [
    ...(selection.thumbnail ? [selection.thumbnail] : []),
    ...selection.gallery,
  ];

  const desiredIds = new Set(
    desired.map((asset) => asset.id),
  );

  let rows = await getRows(productId);

  // Add missing media, including a new thumbnail if selected.
  for (const [index, asset] of desired.entries()) {
    if (rows.some((row) => row.media_id === asset.id)) {
      continue;
    }

    await api<unknown>(url, {
      method: "POST",
      body: JSON.stringify({
        action: "attach",
        mediaId: asset.id,
        isFeatured: selection.thumbnail?.id === asset.id,
        position: index,
      }),
    });

    // Refresh so retries use real image relation IDs.
    rows = await getRows(productId);
  }

  // Promote the selected thumbnail before deleting old images.
  const featuredMediaId = selection.thumbnail?.id;

  if (featuredMediaId) {
    const selected = rows.find(
      (row) => row.media_id === featuredMediaId,
    );

    if (!selected) {
      throw new Error("Thumbnail attachment not found.");
    }

    if (!selected.is_featured) {
      await api<unknown>(url, {
        method: "PATCH",
        body: JSON.stringify({
          imageId: selected.id,
        }),
      });
    }
  }

  // Remove images that were removed from the editor selection.
  for (const row of rows) {
    if (desiredIds.has(row.media_id)) continue;

    await api<unknown>(
      `${url}?imageId=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
  }

  rows = await getRows(productId);

  // Backend automatically maintains a featured image.
  // If there is no explicit thumbnail, existing gallery
  // images may be automatically featured by the backend.
  const orderedIds = desired.map((asset) => {
    const row = rows.find(
      (item) => item.media_id === asset.id,
    );

    if (!row) {
      throw new Error("Image missing after synchronization.");
    }

    return row.id;
  });

  if (orderedIds.length !== rows.length) {
    throw new Error(
      "Gallery changed during save. Reload before retrying.",
    );
  }

  if (orderedIds.length > 0) {
    await api<unknown>(url, {
      method: "PUT",
      body: JSON.stringify({
        imageIds: orderedIds,
      }),
    });
  }
}
