
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

type Context = {
  params: Promise<{ id: string }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function getTrustedOrigin(): string {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) {
    throw new Error("ADMIN_APP_ORIGIN is required.");
  }

  const url = new URL(configured);

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN.");
  }

  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);

  if (url.protocol !== "https:" && !local) {
    throw new Error("HTTPS is required.");
  }

  return url.origin;
}

async function handle(
  request: NextRequest,
  context: Context,
) {
  const { id } = await context.params;

  if (!UUID.test(id)) {
    return failure(400, "Invalid product ID.");
  }

  const method = request.method.toUpperCase();
  const action = request.nextUrl.searchParams.get("action");

  const allowed =
    (method === "GET" && action === null) ||
    (method === "PATCH" &&
      (action === null || action === "variable")) ||
    (method === "DELETE" &&
      (action === "trash" || action === "permanent")) ||
    (method === "POST" && action === "restore");

  if (!allowed) {
    return failure(404, "Unsupported product operation.");
  }

  const mutation = method !== "GET";

  let origin: string;

  try {
    origin = getTrustedOrigin();
  } catch {
    return failure(500, "Invalid server configuration.");
  }

  if (mutation) {
    const fetchSite = request.headers.get("sec-fetch-site");

    if (
      request.nextUrl.origin !== origin ||
      request.headers.get("origin") !== origin ||
      (fetchSite !== null &&
        fetchSite !== "same-origin" &&
        fetchSite !== "none")
    ) {
      return failure(403, "Origin not allowed.");
    }
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  const cookie = `${getAdminCookieName()}=${token}`;

  let base: string;

  try {
    base = getNestApiUrl();
  } catch {
    return failure(500, "Invalid API configuration.");
  }

  let suffix = "";

  if (action === "restore") suffix = "/restore";
  if (action === "permanent") suffix = "/permanent";
  if (action === "variable") suffix = "/variable";

  const endpoint =
    `${base}/api/v1/admin/products/${id}${suffix}`;

  try {
    let csrfToken: string | undefined;

    if (mutation) {
      const csrfResponse = await fetch(
        `${base}/api/v1/admin/auth/csrf`,
        {
          headers: {
            Cookie: cookie,
            Accept: "application/json",
          },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(8000),
        },
      );

      if (csrfResponse.status === 401) {
        return failure(401, "Session expired.");
      }

      if (!csrfResponse.ok) {
        return failure(502, "CSRF verification unavailable.");
      }

      const csrf: unknown = await csrfResponse.json();

      if (
        !csrf ||
        typeof csrf !== "object" ||
        !("data" in csrf) ||
        !csrf.data ||
        typeof csrf.data !== "object" ||
        !("csrfToken" in csrf.data) ||
        typeof csrf.data.csrfToken !== "string" ||
        !csrf.data.csrfToken
      ) {
        return failure(502, "Invalid CSRF response.");
      }

      csrfToken = csrf.data.csrfToken;
    }

    let body: string | undefined;

    if (method === "PATCH") {
      const contentType = request.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

      if (contentType !== "application/json") {
        return failure(415, "JSON required.");
      }

      const length = Number(
        request.headers.get("content-length") ?? "0",
      );

      if (length > 1000000) {
        return failure(413, "Payload too large.");
      }

      body = await request.text();

      if (Buffer.byteLength(body, "utf8") > 1000000) {
        return failure(413, "Payload too large.");
      }

      try {
        const parsed: unknown = JSON.parse(body);

        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          return failure(400, "Invalid product payload.");
        }
      } catch {
        return failure(400, "Invalid JSON.");
      }
    }

    // Permanent deletion requires the product UUID
    // as an explicit confirmation on the backend.
    const upstream = await fetch(endpoint, {
      method,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        ...(mutation
          ? {
              Origin: origin,
              "X-CSRF-Token": csrfToken!,
            }
          : {}),
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(action === "permanent"
          ? { "X-Confirm-Permanent-Delete": id }
          : {}),
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected API redirect.");
    }

    const raw = await upstream.text();

    if (raw.length > 2000000) {
      return failure(502, "API response too large.");
    }

    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch {
      return failure(502, "Invalid API response.");
    }

    return NextResponse.json(data, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return failure(503, "Product service unavailable.");
  }
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context);
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context);
}
