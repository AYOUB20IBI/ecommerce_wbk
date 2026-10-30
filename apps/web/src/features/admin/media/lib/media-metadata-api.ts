
import {
  mediaRequest,
  normalizeMedia,
  type MediaAsset,
} from "./media-api";

export type MediaDetails = MediaAsset & {
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  status: string | null;
};

export type MediaActivity = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  changes: string | null;
  createdAt: string;
};

function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid media response.");
  }

  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

export function normalizeDetails(value: unknown): MediaDetails {
  const data = record(value);
  const asset = normalizeMedia(data);

  return {
    ...asset,
    size:
      numberOrNull(data.fileSize) ??
      asset.size,
    width: numberOrNull(data.width),
    height: numberOrNull(data.height),
    uploadedBy: stringOrNull(data.uploadedBy),
    updatedBy: stringOrNull(data.updatedBy),
    updatedAt: stringOrNull(data.updatedAt),
    status: stringOrNull(data.status),
  };
}

export async function getMediaDetails(
  id: string,
  signal?: AbortSignal,
): Promise<MediaDetails> {
  const response = await mediaRequest(
    `/api/admin/media-metadata?id=${encodeURIComponent(id)}`,
    { signal },
  );

  return normalizeDetails(response);
}

export async function getMediaActivity(
  id: string,
  signal?: AbortSignal,
): Promise<MediaActivity[]> {
  const response = await mediaRequest(
    `/api/admin/media-metadata?id=${encodeURIComponent(id)}&mode=activity`,
    { signal },
  );

  if (!Array.isArray(response)) {
    throw new Error("Invalid media activity response.");
  }

  return response.map((item) => {
    const data = record(item);

    if (
      typeof data.id !== "string" ||
      typeof data.action !== "string" ||
      typeof data.createdAt !== "string"
    ) {
      throw new Error("Invalid audit record.");
    }

    return {
      id: data.id,
      action: data.action,
      actorId: stringOrNull(data.actorId),
      actorName:
        stringOrNull(data.actorName) ??
        (data.actorId ? "Admin user" : "System"),
      changes: stringOrNull(data.changes),
      createdAt: data.createdAt,
    };
  });
}

export async function updateMediaAltText(
  id: string,
  altText: string | null,
): Promise<MediaDetails> {
  const response = await mediaRequest(
    `/api/admin/media-metadata?id=${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ altText }),
    },
  );

  return normalizeDetails(response);
}
