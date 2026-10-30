
// export type MediaAsset = {
//   id: string;
//   url: string | null;
//   originalName: string | null;
//   altText: string | null;
//   sourceType: string;
//   createdAt: string | null;
//   mimeType: string | null;
//   size: number | null;
// };

// export type MediaPage = {
//   items: MediaAsset[];
//   page: number;
//   totalPages: number;
//   total: number;
// };

// export type MediaDeletion = {
//   id: string;
//   status: string;
//   message?: string;
//   queued?: boolean;
// };

// type ApiEnvelope = {
//   success?: unknown;
//   message?: unknown;
//   data?: unknown;
// };

// function isRecord(
//   value: unknown,
// ): value is Record<string, unknown> {
//   return (
//     typeof value === "object" &&
//     value !== null &&
//     !Array.isArray(value)
//   );
// }

// function str(value: unknown): string | null {
//   return typeof value === "string" ? value : null;
// }

// function num(value: unknown): number | null {
//   return typeof value === "number" &&
//     Number.isFinite(value)
//     ? value
//     : null;
// }

// export function normalizeMedia(
//   value: unknown,
// ): MediaAsset {
//   if (!isRecord(value) || typeof value.id !== "string") {
//     throw new Error("Invalid media record.");
//   }

//   return {
//     id: value.id,
//     url:
//       str(value.url) ??
//       str(value.externalUrl) ??
//       str(value.external_url),
//     originalName:
//       str(value.originalName) ??
//       str(value.original_name) ??
//       str(value.filename) ??
//       str(value.fileName),
//     altText:
//       str(value.altText) ??
//       str(value.alt_text),
//     sourceType:
//       str(value.sourceType) ??
//       str(value.source_type) ??
//       "unknown",
//     createdAt:
//       str(value.createdAt) ??
//       str(value.created_at),
//     mimeType:
//       str(value.mimeType) ??
//       str(value.mime_type),
//     size:
//       num(value.sizeBytes) ??
//       num(value.size_bytes) ??
//       num(value.size),
//   };
// }

// export function normalizeMediaPage(
//   value: unknown,
// ): MediaPage {
//   if (!isRecord(value) || !Array.isArray(value.items)) {
//     throw new Error("Invalid Media Library response.");
//   }

//   const pagination = isRecord(value.pagination)
//     ? value.pagination
//     : value;

//   return {
//     items: value.items.map(normalizeMedia),
//     page: num(pagination.page) ?? 1,
//     totalPages: Math.max(
//       1,
//       num(pagination.totalPages) ??
//         num(pagination.total_pages) ??
//         1,
//     ),
//     total: num(pagination.total) ?? value.items.length,
//   };
// }

// export function getMediaPreviewUrl(
//   asset: Pick<MediaAsset, "url">,
// ): string | null {
//   if (!asset.url) {
//     return null;
//   }

//   // Relative image URL from the application itself.
//   if (
//     asset.url.startsWith("/") &&
//     !asset.url.startsWith("//")
//   ) {
//     return asset.url;
//   }

//   let parsed: URL;

//   try {
//     parsed = new URL(asset.url);
//   } catch {
//     return null;
//   }

//   if (
//     !["http:", "https:"].includes(parsed.protocol) ||
//     parsed.username ||
//     parsed.password
//   ) {
//     return null;
//   }

//   const hostname = parsed.hostname.toLowerCase();

//   const localApiHost =
//     hostname === "localhost" ||
//     hostname === "127.0.0.1";

//   const localApiPort = parsed.port === "3001";

//   const isUpload = parsed.pathname.startsWith("/uploads/");

//   // During local development, load NestJS uploads through
//   // the authenticated Next.js same-origin image proxy.
//   //
//   // This avoids cross-origin image restrictions between:
//   // localhost:3000 and localhost:3001.
//   if (
//     localApiHost &&
//     localApiPort &&
//     isUpload &&
//     !parsed.search &&
//     !parsed.hash
//   ) {
//     const segments = parsed.pathname
//       .slice("/uploads/".length)
//       .split("/");

//     if (
//       segments.length >= 3 &&
//       segments.length <= 8 &&
//       segments.every(
//         (segment) =>
//           segment !== "." &&
//           segment !== ".." &&
//           /^[a-zA-Z0-9._-]+$/.test(segment),
//       )
//     ) {
//       return (
//         "/api/admin/media-preview/" +
//         segments
//           .map((segment) => encodeURIComponent(segment))
//           .join("/")
//       );
//     }
//   }

//   // Other public external media URLs remain direct.
//   return parsed.href;
// }

// export async function mediaRequest(
//   url: string,
//   options: RequestInit = {},
// ): Promise<unknown> {
//   const response = await fetch(url, {
//     ...options,
//     credentials: "same-origin",
//     cache: "no-store",
//     headers: {
//       Accept: "application/json",
//       ...(options.headers ?? {}),
//     },
//   });

//   if (response.status === 401) {
//     throw new Error(
//       "Session expired. Please sign in again.",
//     );
//   }

//   let body: ApiEnvelope;

//   try {
//     body = (await response.json()) as ApiEnvelope;
//   } catch {
//     throw new Error("Invalid Media API response.");
//   }

//   if (!response.ok || body.success !== true) {
//     throw new Error(
//       typeof body.message === "string"
//         ? body.message
//         : `Media request failed (${response.status}).`,
//     );
//   }

//   if (body.data === undefined) {
//     throw new Error("Media response is missing data.");
//   }

//   return body.data;
// }

// export async function getMediaPage(
//   page: number,
//   signal?: AbortSignal,
// ): Promise<MediaPage> {
//   const value = await mediaRequest(
//     `/api/admin/media-library?page=${page}&limit=24`,
//     { signal },
//   );

//   return normalizeMediaPage(value);
// }

// export async function getMediaById(
//   id: string,
// ): Promise<MediaAsset> {
//   return normalizeMedia(
//     await mediaRequest(
//       `/api/admin/media-library?id=${encodeURIComponent(id)}`,
//     ),
//   );
// }

// export async function uploadMediaFile(
//   file: File,
// ): Promise<MediaAsset> {
//   const maxBytes = 5 * 1024 * 1024;

//   if (
//     file.size === 0 ||
//     file.size > maxBytes ||
//     ![
//       "image/jpeg",
//       "image/png",
//       "image/webp",
//     ].includes(file.type)
//   ) {
//     throw new Error(
//       `${file.name}: select JPEG, PNG or WebP up to 5 MB.`,
//     );
//   }

//   const data = new FormData();
//   data.set("file", file, file.name);

//   return normalizeMedia(
//     await mediaRequest("/api/admin/media-library", {
//       method: "POST",
//       body: data,
//     }),
//   );
// }

// export async function createExternalMedia(
//   url: string,
//   altText: string,
// ): Promise<MediaAsset> {
//   return normalizeMedia(
//     await mediaRequest("/api/admin/media-library", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         url: url.trim(),
//         altText: altText.trim() || null,
//       }),
//     }),
//   );
// }

// export async function deleteMedia(
//   id: string,
// ): Promise<MediaDeletion> {
//   const result = await mediaRequest(
//     `/api/admin/media-library?id=${encodeURIComponent(id)}`,
//     { method: "DELETE" },
//   );

//   if (!isRecord(result)) {
//     throw new Error("Invalid media deletion response.");
//   }

//   if (result.completed === true) {
//     return {
//       id,
//       status: "requested",
//       queued: true,
//     };
//   }

//   const returnedId = str(result.id);

//   if (returnedId !== null && returnedId !== id) {
//     throw new Error("Media deletion response ID mismatch.");
//   }

//   const status = str(result.status);

//   if (status === null && result.queued !== true) {
//     throw new Error(
//       "Media deletion response is missing status.",
//     );
//   }

//   return {
//     id,
//     status: status ?? "queued",
//     message: str(result.message) ?? undefined,
//     queued:
//       typeof result.queued === "boolean"
//         ? result.queued
//         : undefined,
//   };
// }

// export function formatMediaSize(
//   size: number | null,
// ): string {
//   if (size === null) {
//     return "Unknown size";
//   }

//   if (size < 1024) {
//     return `${size} B`;
//   }

//   if (size < 1024 * 1024) {
//     return `${(size / 1024).toFixed(1)} KB`;
//   }

//   return `${(size / 1048576).toFixed(2)} MB`;
// }



export type MediaAsset = {
  id: string;
  url: string | null;
  originalName: string | null;
  altText: string | null;
  sourceType: string;
  createdAt: string | null;
  mimeType: string | null;
  size: number | null;
};

export type MediaPage = {
  items: MediaAsset[];
  page: number;
  totalPages: number;
  total: number;
};

export type MediaDeletion = {
  id: string;
  status: string;
  message?: string;
  queued?: boolean;
};

type ApiEnvelope = {
  success?: unknown;
  message?: unknown;
  data?: unknown;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

export function normalizeMedia(value: unknown): MediaAsset {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Invalid media record.");
  }

  return {
    id: value.id,
    url:
      str(value.url) ??
      str(value.externalUrl) ??
      str(value.external_url),
    originalName:
      str(value.originalName) ??
      str(value.original_name) ??
      str(value.filename) ??
      str(value.fileName),
    altText:
      str(value.altText) ??
      str(value.alt_text),
    sourceType:
      str(value.sourceType) ??
      str(value.source_type) ??
      "unknown",
    createdAt:
      str(value.createdAt) ??
      str(value.created_at),
    mimeType:
      str(value.mimeType) ??
      str(value.mime_type),
    size:
      num(value.fileSize) ??
      num(value.file_size) ??
      num(value.sizeBytes) ??
      num(value.size_bytes) ??
      num(value.size),
  };
}

export function normalizeMediaPage(
  value: unknown,
): MediaPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Invalid Media Library response.");
  }

  const pagination = isRecord(value.pagination)
    ? value.pagination
    : value;

  return {
    items: value.items.map(normalizeMedia),
    page: num(pagination.page) ?? 1,
    totalPages: Math.max(
      1,
      num(pagination.totalPages) ??
        num(pagination.total_pages) ??
        1,
    ),
    total:
      num(pagination.total) ??
      value.items.length,
  };
}

export function getMediaPreviewUrl(
  asset: Pick<MediaAsset, "url">,
): string | null {
  if (!asset.url) return null;

  if (
    asset.url.startsWith("/") &&
    !asset.url.startsWith("//")
  ) {
    return asset.url;
  }

  let parsed: URL;

  try {
    parsed = new URL(asset.url);
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  const localApiHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  if (
    localApiHost &&
    parsed.port === "3001" &&
    parsed.pathname.startsWith("/uploads/") &&
    !parsed.search &&
    !parsed.hash
  ) {
    const segments = parsed.pathname
      .slice("/uploads/".length)
      .split("/");

    if (
      segments.length >= 3 &&
      segments.length <= 8 &&
      segments.every(
        (segment) =>
          segment !== "." &&
          segment !== ".." &&
          /^[a-zA-Z0-9._-]+$/.test(segment),
      )
    ) {
      return (
        "/api/admin/media-preview/" +
        segments.map(encodeURIComponent).join("/")
      );
    }
  }

  return parsed.href;
}

export async function mediaRequest(
  url: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new Error(
      "Session expired. Please sign in again.",
    );
  }

  let body: ApiEnvelope;

  try {
    body = (await response.json()) as ApiEnvelope;
  } catch {
    throw new Error("Invalid Media API response.");
  }

  if (!response.ok || body.success !== true) {
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : `Media request failed (${response.status}).`,
    );
  }

  if (body.data === undefined) {
    throw new Error("Media response is missing data.");
  }

  return body.data;
}

export async function getMediaPage(
  page: number,
  signal?: AbortSignal,
): Promise<MediaPage> {
  const value = await mediaRequest(
    `/api/admin/media-library?page=${page}&limit=24`,
    { signal },
  );

  return normalizeMediaPage(value);
}

export async function getMediaById(
  id: string,
): Promise<MediaAsset> {
  return normalizeMedia(
    await mediaRequest(
      `/api/admin/media-library?id=${encodeURIComponent(id)}`,
    ),
  );
}

export async function uploadMediaFile(
  file: File,
): Promise<MediaAsset> {
  const maxBytes = 5 * 1024 * 1024;

  if (
    file.size === 0 ||
    file.size > maxBytes ||
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(file.type)
  ) {
    throw new Error(
      `${file.name}: select JPEG, PNG or WebP up to 5 MB.`,
    );
  }

  const data = new FormData();
  data.set("file", file, file.name);

  return normalizeMedia(
    await mediaRequest("/api/admin/media-library", {
      method: "POST",
      body: data,
    }),
  );
}

export async function createExternalMedia(
  url: string,
  altText: string,
): Promise<MediaAsset> {
  return normalizeMedia(
    await mediaRequest("/api/admin/media-library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url.trim(),
        altText: altText.trim() || null,
      }),
    }),
  );
}

export async function deleteMedia(
  id: string,
): Promise<MediaDeletion> {
  const result = await mediaRequest(
    `/api/admin/media-library?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  if (!isRecord(result)) {
    throw new Error("Invalid media deletion response.");
  }

  if (result.completed === true) {
    return {
      id,
      status: "requested",
      queued: true,
    };
  }

  const returnedId = str(result.id);

  if (returnedId !== null && returnedId !== id) {
    throw new Error(
      "Media deletion response ID mismatch.",
    );
  }

  const status = str(result.status);

  if (status === null && result.queued !== true) {
    throw new Error(
      "Media deletion response is missing status.",
    );
  }

  return {
    id,
    status: status ?? "queued",
    message: str(result.message) ?? undefined,
    queued:
      typeof result.queued === "boolean"
        ? result.queued
        : undefined,
  };
}

export function formatMediaSize(
  size: number | null,
): string {
  if (size === null) return "Unknown size";

  if (size < 1024) return `${size} B`;

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1048576).toFixed(2)} MB`;
}
