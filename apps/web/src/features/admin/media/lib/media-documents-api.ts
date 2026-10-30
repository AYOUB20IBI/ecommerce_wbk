
import {
  mediaRequest,
  normalizeMedia,
  type MediaAsset,
} from "./media-api";

export type DocumentKind = "pdf" | "txt" | "csv";

const MAX_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES: Record<DocumentKind, string[]> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
};

export function getDocumentKind(
  asset: Pick<MediaAsset, "mimeType" | "originalName">,
): DocumentKind | null {
  const mime = asset.mimeType?.toLowerCase() ?? "";
  const name = asset.originalName?.toLowerCase() ?? "";

  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "txt";
  if (
    mime === "text/csv" ||
    mime === "application/vnd.ms-excel"
  ) {
    return "csv";
  }

  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".txt")) return "txt";
  if (name.endsWith(".csv")) return "csv";

  return null;
}

export async function uploadDocument(
  file: File,
): Promise<MediaAsset> {
  const extension =
    file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    extension !== "pdf" &&
    extension !== "txt" &&
    extension !== "csv"
  ) {
    throw new Error("Only PDF, TXT and CSV are supported.");
  }

  if (
    file.size === 0 ||
    file.size > MAX_SIZE
  ) {
    throw new Error("Maximum document size is 20 MB.");
  }

  if (!ALLOWED_TYPES[extension].includes(file.type)) {
    throw new Error("Invalid document MIME type.");
  }

  const form = new FormData();
  form.append("file", file, file.name);

  const result = await mediaRequest(
    "/api/admin/media-documents",
    {
      method: "POST",
      body: form,
    },
  );

  return normalizeMedia(result);
}

export async function downloadDocument(
  asset: MediaAsset,
): Promise<void> {
  if (!getDocumentKind(asset)) {
    throw new Error("Only documents can be downloaded here.");
  }

  const response = await fetch(
    `/api/admin/media-documents/${encodeURIComponent(
      asset.id,
    )}/download`,
    {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Document download failed (${response.status}).`,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = (
      asset.originalName || "document"
    ).replace(/[\\/\r\n\x00-\x1F\x7F]/g, "_");

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
