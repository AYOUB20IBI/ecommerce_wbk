
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

type Context = {
  params: Promise<{ path: string[] }>;
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

function isAllowed(method: string, path: string[]) {
  if (path.length === 1) {
    if (path[0] === "users" || path[0] === "roles") {
      return method === "GET" || method === "POST";
    }

    return path[0] === "permissions" && method === "GET";
  }

  if (path.length === 2) {
    if (
      path[0] === "users" &&
      path[1] === "roles"
    ) {
      return method === "GET";
    }

    if (
      (path[0] === "users" || path[0] === "roles") &&
      UUID.test(path[1])
    ) {
      return (
        method === "GET" ||
        method === "PATCH" ||
        (path[0] === "roles" && method === "DELETE")
      );
    }
  }

  if (path.length === 3 && UUID.test(path[1])) {
    if (path[0] === "users") {
      return (
        (path[2] === "roles" && method === "PUT") ||
        (path[2] === "status" && method === "PATCH") ||
        (path[2] === "password" && method === "PATCH")
      );
    }

    return (
      path[0] === "roles" &&
      path[2] === "permissions" &&
      method === "PUT"
    );
  }

  return false;
}

function appOrigin() {
  const raw = process.env.ADMIN_APP_ORIGIN;

  if (!raw) throw new Error("ADMIN_APP_ORIGIN missing");

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

  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error("HTTPS required.");
  }

  return url.origin;
}

async function handle(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();

  if (!isAllowed(method, path)) {
    return failure(404, "Endpoint not found.");
  }

  let origin: string;

  try {
    origin = appOrigin();
  } catch {
    return failure(500, "Server configuration error.");
  }

  const mutation = method !== "GET";

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

    if (method !== "DELETE") {
      const type = request.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

      if (type !== "application/json") {
        return failure(415, "JSON required.");
      }
    }
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  const cookieHeader = `${getAdminCookieName()}=${token}`;

  let base: string;

  try {
    base = getNestApiUrl();
  } catch {
    return failure(500, "API configuration error.");
  }

  const query = new URLSearchParams();

  if (method === "GET" && path[0] === "users") {
    for (const key of ["page", "limit", "search"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) query.set(key, value);
    }
  }

  const endpoint =
    `${base}/api/v1/admin/${path.join("/")}` +
    (query.size > 0 ? `?${query}` : "");

  try {
    let csrfToken: string | undefined;

    if (mutation) {
      const csrf = await fetch(
        `${base}/api/v1/admin/auth/csrf`,
        {
          method: "GET",
          headers: {
            Cookie: cookieHeader,
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

      const data: unknown = await csrf.json();

      if (
        !data ||
        typeof data !== "object" ||
        !("data" in data) ||
        !data.data ||
        typeof data.data !== "object" ||
        !("csrfToken" in data.data) ||
        typeof data.data.csrfToken !== "string" ||
        !data.data.csrfToken
      ) {
        return failure(502, "Invalid CSRF response.");
      }

      csrfToken = data.data.csrfToken;
    }

    let body: string | undefined;

    if (mutation && method !== "DELETE") {
      const declared = Number(
        request.headers.get("content-length") ?? "0",
      );

      if (declared > 16384) {
        return failure(413, "Request too large.");
      }

      body = await request.text();

      if (Buffer.byteLength(body, "utf8") > 16384) {
        return failure(413, "Request too large.");
      }

      try {
        JSON.parse(body);
      } catch {
        return failure(400, "Invalid JSON.");
      }
    }

    const upstream = await fetch(endpoint, {
      method,
      headers: {
        Cookie: cookieHeader,
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
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected upstream redirect.");
    }

    const raw = await upstream.text();

    if (raw.length > 2_000_000) {
      return failure(502, "Upstream response too large.");
    }

    let result: unknown;

    try {
      result = JSON.parse(raw);
    } catch {
      return failure(502, "Invalid upstream response.");
    }

    return NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failure(503, "Management service unavailable.");
  }
}

export async function GET(
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

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  return handle(request, context);
}

export async function PUT(
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
