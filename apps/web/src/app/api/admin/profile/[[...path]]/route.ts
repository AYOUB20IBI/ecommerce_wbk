
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

type Context = {
  params: Promise<{ path?: string[] }>;
};

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function allowedOrigin(request: NextRequest) {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) return false;

  try {
    const expected = new URL(configured);

    if (
      expected.pathname !== "/" ||
      expected.search ||
      expected.hash ||
      expected.username ||
      expected.password
    ) {
      return false;
    }

    if (
      expected.protocol !== "https:" &&
      !(
        expected.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(
          expected.hostname,
        )
      )
    ) {
      return false;
    }

    const site = request.headers.get("sec-fetch-site");

    return (
      request.nextUrl.origin === expected.origin &&
      request.headers.get("origin") === expected.origin &&
      (site === null ||
        site === "same-origin" ||
        site === "none")
    );
  } catch {
    return false;
  }
}

async function handler(
  request: NextRequest,
  context: Context,
) {
  const { path = [] } = await context.params;

  const method = request.method;
  const isProfile = path.length === 0;
  const isPassword =
    path.length === 1 && path[0] === "password";

  const permitted =
    (method === "GET" && isProfile) ||
    (method === "PATCH" && (isProfile || isPassword));

  if (!permitted) {
    return failure(404, "Endpoint not found.");
  }

  if (method === "PATCH" && !allowedOrigin(request)) {
    return failure(403, "Origin not allowed.");
  }

  if (
    method === "PATCH" &&
    request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    return failure(415, "JSON required.");
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  const base = getNestApiUrl();
  const cookie = `${getAdminCookieName()}=${token}`;

  try {
    let csrfToken: string | null = null;
    let body: string | undefined;

    if (method === "PATCH") {
      body = await request.text();

      if (Buffer.byteLength(body, "utf8") > 16384) {
        return failure(413, "Request too large.");
      }

      try {
        JSON.parse(body);
      } catch {
        return failure(400, "Invalid JSON.");
      }

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

      if (!csrf.ok) {
        return failure(
          csrf.status === 401 ? 401 : 502,
          "Could not verify CSRF token.",
        );
      }

      const result: unknown = await csrf.json();

      if (
        !result ||
        typeof result !== "object" ||
        !("data" in result) ||
        !result.data ||
        typeof result.data !== "object" ||
        !("csrfToken" in result.data) ||
        typeof result.data.csrfToken !== "string"
      ) {
        return failure(502, "Invalid CSRF response.");
      }

      csrfToken = result.data.csrfToken;
    }

    const upstream = await fetch(
      `${base}/api/v1/admin/profile${isPassword ? "/password" : ""}`,
      {
        method,
        headers: {
          Cookie: cookie,
          Accept: "application/json",
          ...(method === "PATCH"
            ? {
                Origin: new URL(
                  process.env.ADMIN_APP_ORIGIN!,
                ).origin,
                "X-CSRF-Token": csrfToken!,
                "Content-Type": "application/json",
              }
            : {}),
        },
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      },
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected API redirect.");
    }

    const raw = await upstream.text();

    if (raw.length > 100000) {
      return failure(502, "Invalid API response.");
    }

    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch {
      return failure(502, "Invalid API response.");
    }

    return NextResponse.json(data, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failure(503, "Profile service unavailable.");
  }
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  return handler(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  return handler(request, context);
}
