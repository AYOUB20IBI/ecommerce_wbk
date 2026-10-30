
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const MAX_FILE = 20 * 1024 * 1024;
const MAX_BODY = MAX_FILE + 16384;

const TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
};

function error(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function trustedOrigin(request: NextRequest): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;
  if (!configured) return null;

  try {
    const url = new URL(configured);
    const isLocal =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);

    if (url.protocol !== "https:" && !isLocal) {
      return null;
    }

    if (request.headers.get("origin") !== url.origin) {
      return null;
    }

    const site = request.headers.get("sec-fetch-site");

    if (site && !["same-origin", "none"].includes(site)) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

async function getCsrf(token: string): Promise<string> {
  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/auth/csrf`,
    {
      headers: {
        Accept: "application/json",
        Cookie: `${getAdminCookieName()}=${token}`,
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error("CSRF request failed.");
  }

  const body: unknown = await response.json();

  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !body.data ||
    typeof body.data !== "object" ||
    !("csrfToken" in body.data) ||
    typeof body.data.csrfToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.data.csrfToken)
  ) {
    throw new Error("Invalid CSRF response.");
  }

  return body.data.csrfToken;
}

export async function POST(request: NextRequest) {
  const origin = trustedOrigin(request);

  if (!origin) {
    return error("Request origin not allowed.", 403);
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return error("Authentication required.", 401);
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return error("Multipart upload required.", 415);
  }

  const length = request.headers.get("content-length");

  if (
    length !== null &&
    (!Number.isSafeInteger(Number(length)) ||
      Number(length) < 0 ||
      Number(length) > MAX_BODY)
  ) {
    return error("Maximum upload size exceeded.", 413);
  }

  try {
    if (!request.body) {
      return error("Upload body missing.", 400);
    }

    // Bound actual received bytes, even without Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;

      if (received > MAX_BODY) {
        await reader.cancel();
        return error("Maximum upload size exceeded.", 413);
      }

      chunks.push(value);
    }

    const multipart = new Request(
      "http://localhost/media-upload",
      {
        method: "POST",
        headers: { "content-type": contentType },
        body: new Blob(
          chunks.map((chunk) => Uint8Array.from(chunk)),
        ),
      },
    );

    const form = await multipart.formData();

    if (
      form.getAll("file").length !== 1 ||
      [...form.keys()].some((key) => key !== "file")
    ) {
      return error("Exactly one file is required.", 400);
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      return error("Invalid document.", 400);
    }

    if (file.size === 0 || file.size > MAX_FILE) {
      return error("Document must be under 20 MB.", 413);
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() ?? "";

    if (
      !TYPES[extension] ||
      !TYPES[extension].includes(file.type)
    ) {
      return error("Unsupported document format.", 415);
    }

    const csrf = await getCsrf(token);
    const outgoing = new FormData();
    outgoing.append("file", file, file.name);

    const backend = await fetch(
      `${getNestApiUrl()}/api/v1/admin/media/documents`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: `${getAdminCookieName()}=${token}`,
          Origin: origin,
          "x-csrf-token": csrf,
        },
        body: outgoing,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      },
    );

    const type = backend.headers.get("content-type") ?? "";

    if (!type.includes("application/json")) {
      return error("Invalid backend response.", 502);
    }

    const result: unknown = await backend.json();

    if (
      backend.status >= 300 && backend.status < 400
    ) {
      return error("Unexpected backend redirect.", 502);
    }

    return NextResponse.json(result, {
      status: backend.status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error(
      "Upload result unknown. Refresh the library before retrying.",
      502,
    );
  }
}
