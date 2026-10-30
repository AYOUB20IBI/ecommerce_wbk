
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    path: string[];
  }>;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function failure(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function isValidSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment.length <= 255 &&
    /^[a-zA-Z0-9._-]+$/.test(segment) &&
    segment !== "." &&
    segment !== ".."
  );
}

function isAllowedImagePath(segments: string[]): boolean {
  if (
    segments.length < 3 ||
    segments.length > 8 ||
    segments.some((segment) => !isValidSegment(segment))
  ) {
    return false;
  }

  const filename = segments[segments.length - 1];

  return /\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(filename);
}

function storageOrigin(): string {
  const backend = new URL(getNestApiUrl());

  if (
    backend.protocol !== "http:" &&
    backend.protocol !== "https:"
  ) {
    throw new Error("Invalid storage origin.");
  }

  if (
    backend.username ||
    backend.password ||
    backend.search ||
    backend.hash
  ) {
    throw new Error("Invalid storage origin.");
  }

  return backend.origin;
}

async function readLimitedImage(
  response: Response,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body) {
    throw new Error("Empty image response.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > MAX_IMAGE_BYTES) {
        throw new Error("Image exceeds preview size limit.");
      }

      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (total === 0) {
    throw new Error("Empty image.");
  }

  const output = new Uint8Array(new ArrayBuffer(total));

  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  const session = await getAdminSessionToken();

  if (!session) {
    return failure("Authentication required.", 401);
  }

  const { path } = await context.params;

  if (!Array.isArray(path) || !isAllowedImagePath(path)) {
    return failure("Invalid image path.", 400);
  }

  let origin: string;

  try {
    origin = storageOrigin();
  } catch {
    return failure("Invalid storage configuration.", 500);
  }

  const encodedPath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const sourceUrl = `${origin}/uploads/${encodedPath}`;

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        Accept:
          "image/avif,image/webp,image/png,image/jpeg,image/gif",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return failure(
        response.status === 404
          ? "Image not found."
          : "Unable to load image.",
        response.status === 404 ? 404 : 502,
      );
    }

    const contentType = (
      response.headers.get("content-type") ?? ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_TYPES.has(contentType)) {
      return failure("Unsupported image format.", 415);
    }

    const declaredSize = response.headers.get("content-length");

    if (
      declaredSize !== null &&
      (
        !Number.isFinite(Number(declaredSize)) ||
        Number(declaredSize) > MAX_IMAGE_BYTES
      )
    ) {
      return failure("Image too large.", 413);
    }

    const bytes = await readLimitedImage(response);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return failure("Unable to retrieve image.", 502);
  }
}
