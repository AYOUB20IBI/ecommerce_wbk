
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

const ALLOWED_PARAMS = new Set([
  "page", "limit", "search", "status", "type",
  "categoryId", "brandId", "tagId", "attributeId",
  "valueId", "minPrice", "maxPrice", "stockStatus",
  "isFeatured", "trash", "sortBy", "sortOrder",
]);

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function trustedOrigin() {
  const raw = process.env.ADMIN_APP_ORIGIN;

  if (!raw) throw new Error("Missing ADMIN_APP_ORIGIN");

  const url = new URL(raw);

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN");
  }

  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);

  if (url.protocol !== "https:" && !local) {
    throw new Error("HTTPS required.");
  }

  return url.origin;
}

async function session() {
  const token = await getAdminSessionToken();

  if (!token) return null;

  return `${getAdminCookieName()}=${token}`;
}

async function forward(
  url: string,
  cookie: string,
  method: "GET" | "POST",
  origin?: string,
  csrfToken?: string,
  body?: string,
) {
  const upstream = await fetch(url, {
    method,
    headers: {
      Cookie: cookie,
      Accept: "application/json",
      ...(method === "POST"
        ? {
            Origin: origin!,
            "X-CSRF-Token": csrfToken!,
            "Content-Type": "application/json",
          }
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

  let result: unknown;

  try {
    result = JSON.parse(raw);
  } catch {
    return failure(502, "Invalid API response.");
  }

  return NextResponse.json(result, {
    status: upstream.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const cookie = await session();

  if (!cookie) {
    return failure(401, "Authentication required.");
  }

  const query = new URLSearchParams();

  for (const [key, value] of request.nextUrl.searchParams) {
    if (!ALLOWED_PARAMS.has(key) || query.has(key)) {
      return failure(400, "Invalid product filter.");
    }

    query.set(key, value);
  }

  try {
    const endpoint = new URL(
      "/api/v1/admin/products",
      getNestApiUrl(),
    );

    endpoint.search = query.toString();

    return await forward(
      endpoint.toString(),
      cookie,
      "GET",
    );
  } catch {
    return failure(503, "Product service unavailable.");
  }
}

export async function POST(request: NextRequest) {
  let origin: string;

  try {
    origin = trustedOrigin();
  } catch {
    return failure(500, "Server configuration error.");
  }

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

  if (
    request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  ) {
    return failure(415, "JSON required.");
  }

  const cookie = await session();

  if (!cookie) {
    return failure(401, "Authentication required.");
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (declaredLength > 1000000) {
    return failure(413, "Payload too large.");
  }

  const body = await request.text();

  if (Buffer.byteLength(body, "utf8") > 1000000) {
    return failure(413, "Payload too large.");
  }

  try {
    const data: unknown = JSON.parse(body);

    if (
      data === null ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return failure(400, "Invalid product payload.");
    }
  } catch {
    return failure(400, "Invalid JSON.");
  }

  try {
    const base = getNestApiUrl();

    const csrf = await fetch(
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

    if (csrf.status === 401) {
      return failure(401, "Session expired.");
    }

    if (!csrf.ok) {
      return failure(502, "CSRF service unavailable.");
    }

    const result: unknown = await csrf.json();

    if (
      !result ||
      typeof result !== "object" ||
      !("data" in result) ||
      !result.data ||
      typeof result.data !== "object" ||
      !("csrfToken" in result.data) ||
      typeof result.data.csrfToken !== "string" ||
      !result.data.csrfToken
    ) {
      return failure(502, "Invalid CSRF response.");
    }

    return await forward(
      `${base}/api/v1/admin/products`,
      cookie,
      "POST",
      origin,
      result.data.csrfToken,
      body,
    );
  } catch {
    return failure(503, "Product service unavailable.");
  }
}
