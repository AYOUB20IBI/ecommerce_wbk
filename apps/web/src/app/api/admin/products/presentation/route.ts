
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

function fail(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");

  if (kind !== "categories" && kind !== "authors") {
    return fail(400, "Invalid presentation type.");
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return fail(401, "Authentication required.");
  }

  const url = new URL(
    kind === "categories"
      ? "/api/v1/admin/products/category-tree"
      : "/api/v1/admin/products/authors",
    getNestApiUrl(),
  );

  if (kind === "authors") {
    const raw =
      request.nextUrl.searchParams.get("ids") ?? "";

    const ids = raw.split(",");

    if (
      ids.length < 1 ||
      ids.length > 100 ||
      ids.some((id) => !UUID.test(id)) ||
      new Set(ids).size !== ids.length
    ) {
      return fail(400, "Invalid product IDs.");
    }

    url.searchParams.set("ids", ids.join(","));
  }

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        Cookie: `${getAdminCookieName()}=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    if (
      upstream.status >= 300 &&
      upstream.status < 400
    ) {
      return fail(502, "Unexpected API redirect.");
    }

    if (upstream.status === 401) {
      return fail(401, "Session expired.");
    }

    if (upstream.status === 403) {
      return fail(403, "Permission denied.");
    }

    const raw = await upstream.text();

    if (raw.length > 600000) {
      return fail(502, "Response too large.");
    }

    let body: unknown;

    try {
      body = JSON.parse(raw);
    } catch {
      return fail(502, "Invalid API response.");
    }

    return NextResponse.json(body, {
      status: upstream.status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return fail(503, "Presentation service unavailable.");
  }
}
