import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: NO_STORE },
  );
}

function trustedOrigin(): string {
  const raw = process.env.ADMIN_APP_ORIGIN;

  if (!raw) {
    throw new Error("Missing ADMIN_APP_ORIGIN.");
  }

  const url = new URL(raw);

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN.");
  }

  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(
      url.hostname,
    );

  if (url.protocol !== "https:" && !local) {
    throw new Error("HTTPS required.");
  }

  return url.origin;
}

export async function POST(request: NextRequest) {
  let origin: string;

  try {
    origin = trustedOrigin();
  } catch {
    return failure(500, "Invalid admin configuration.");
  }

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    request.nextUrl.origin !== origin ||
    request.headers.get("origin") !== origin ||
    (
      fetchSite !== null &&
      fetchSite !== "same-origin" &&
      fetchSite !== "none"
    )
  ) {
    return failure(403, "Origin not allowed.");
  }

  if (
    request.headers.get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  ) {
    return failure(415, "JSON required.");
  }

  const raw = await request.text();

  if (new TextEncoder().encode(raw).length > 4096) {
    return failure(413, "Request too large.");
  }

  let input: unknown;

  try {
    input = JSON.parse(raw);
  } catch {
    return failure(400, "Invalid JSON.");
  }

  if (
    !input ||
    typeof input !== "object" ||
    !("ids" in input) ||
    !Array.isArray(input.ids)
  ) {
    return failure(400, "Product IDs required.");
  }

  const ids: unknown[] = input.ids;

  if (
    ids.length < 1 ||
    ids.length > 20 ||
    ids.some(
      (id) =>
        typeof id !== "string" ||
        !UUID.test(id),
    ) ||
    new Set(ids).size !== ids.length
  ) {
    return failure(
      400,
      "Select 1–20 valid distinct products.",
    );
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  try {
    const base = getNestApiUrl();
    const cookie = `${getAdminCookieName()}=${token}`;

    const csrfResponse = await fetch(
      new URL("/api/v1/admin/auth/csrf", base),
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

    if (!csrfResponse.ok) {
      return failure(
        csrfResponse.status === 401 ? 401 : 502,
        "CSRF verification unavailable.",
      );
    }

    const csrf: unknown = await csrfResponse.json();

    if (
      !csrf ||
      typeof csrf !== "object" ||
      !("data" in csrf) ||
      !csrf.data ||
      typeof csrf.data !== "object" ||
      !("csrfToken" in csrf.data) ||
      typeof csrf.data.csrfToken !== "string"
    ) {
      return failure(502, "Invalid CSRF response.");
    }

    const upstream = await fetch(
      new URL("/api/v1/admin/products/bulk-trash", base),
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "X-CSRF-Token": csrf.data.csrfToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ids }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      },
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected API redirect.");
    }

    const responseText = await upstream.text();

    if (responseText.length > 100000) {
      return failure(502, "Unexpected response size.");
    }

    let result: unknown;

    try {
      result = JSON.parse(responseText);
    } catch {
      return failure(502, "Invalid bulk response.");
    }

    return NextResponse.json(result, {
      status: upstream.status,
      headers: NO_STORE,
    });
  } catch {
    return failure(
      503,
      "Bulk Trash temporarily unavailable.",
    );
  }
}