
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

import {
  getCurrentAdminAccess,
} from "@/lib/auth/admin-access-server";

import {
  settingsSchema,
} from "@/features/admin/media/lib/media-settings-api";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;

function reply(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function failure(message: string, status: number) {
  return reply({ success: false, message }, status);
}

function isAdmin(roles: string[]): boolean {
  return roles.some((role) => {
    const normalized = role
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    return (
      normalized === "admin" ||
      normalized === "super admin"
    );
  });
}

async function authorize() {
  const token = await getAdminSessionToken();

  if (!token) {
    return { token: null, status: 401 };
  }

  const access = await getCurrentAdminAccess();

  if (!access) {
    return { token: null, status: 401 };
  }

  if (!isAdmin(access.roles)) {
    return { token: null, status: 403 };
  }

  return { token, status: 200 };
}

function getOrigin(request: NextRequest): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) return null;

  try {
    const expected = new URL(configured);

    if (
      expected.protocol !== "https:" &&
      !(
        expected.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(
          expected.hostname,
        )
      )
    ) {
      return null;
    }

    const origin = request.headers.get("origin");

    if (origin !== expected.origin) {
      return null;
    }

    const fetchSite =
      request.headers.get("sec-fetch-site");

    if (
      fetchSite &&
      !["same-origin", "none"].includes(fetchSite)
    ) {
      return null;
    }

    return origin;
  } catch {
    return null;
  }
}

function cookie(token: string): string {
  return `${getAdminCookieName()}=${token}`;
}

async function getCsrf(token: string): Promise<string> {
  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/auth/csrf`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie(token),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error("CSRF verification failed.");
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

async function forward(
  token: string,
  method: "GET" | "PATCH",
  options?: {
    origin: string;
    csrf: string;
    body: string;
  },
) {
  const headers = new Headers({
    Accept: "application/json",
    Cookie: cookie(token),
  });

  if (options) {
    headers.set("Content-Type", "application/json");
    headers.set("Origin", options.origin);
    headers.set("x-csrf-token", options.csrf);
  }

  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/settings/media`,
    {
      method,
      headers,
      body: options?.body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );

  if (response.status >= 300 && response.status < 400) {
    return failure("Unexpected backend redirect.", 502);
  }

  if (
    !(response.headers.get("content-type") ?? "")
      .includes("application/json")
  ) {
    return failure("Invalid backend response.", 502);
  }

  const body: unknown = await response.json();

  if (
    !body ||
    typeof body !== "object" ||
    !("success" in body) ||
    typeof body.success !== "boolean"
  ) {
    return failure("Invalid backend response.", 502);
  }

  return reply(body, response.status);
}

export async function GET() {
  try {
    const auth = await authorize();

    if (!auth.token) {
      return failure(
        auth.status === 403
          ? "Admin role required."
          : "Authentication required.",
        auth.status,
      );
    }

    return await forward(auth.token, "GET");
  } catch {
    return failure("Settings service unavailable.", 502);
  }
}

export async function PATCH(request: NextRequest) {
  const origin = getOrigin(request);

  if (!origin) {
    return failure("Request origin not allowed.", 403);
  }

  try {
    const auth = await authorize();

    if (!auth.token) {
      return failure(
        auth.status === 403
          ? "Admin role required."
          : "Authentication required.",
        auth.status,
      );
    }

    if (
      !(request.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return failure("JSON request required.", 415);
    }

    const length = request.headers.get("content-length");

    if (
      length !== null &&
      (!Number.isSafeInteger(Number(length)) ||
        Number(length) > MAX_BODY_BYTES)
    ) {
      return failure("Settings body too large.", 413);
    }

    const raw = await request.text();

    if (
      new TextEncoder().encode(raw).byteLength >
      MAX_BODY_BYTES
    ) {
      return failure("Settings body too large.", 413);
    }

    let input: unknown;

    try {
      input = JSON.parse(raw);
    } catch {
      return failure("Invalid JSON.", 400);
    }

    const validated = settingsSchema.safeParse(input);

    if (!validated.success) {
      return failure("Invalid Media Settings values.", 400);
    }

    const csrf = await getCsrf(auth.token);

    return await forward(auth.token, "PATCH", {
      origin,
      csrf,
      body: JSON.stringify(validated.data),
    });
  } catch {
    return failure(
      "Save result is unknown. Reload settings before retrying.",
      502,
    );
  }
}
