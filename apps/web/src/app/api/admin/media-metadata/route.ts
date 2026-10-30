
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const mediaIdSchema = z.uuid();

const updateSchema = z.strictObject({
  altText: z.string().trim().max(255).nullable(),
});

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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function originAllowed(
  request: NextRequest,
): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) return null;

  try {
    const url = new URL(configured);

    const local =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);

    if (url.protocol !== "https:" && !local) return null;

    if (request.headers.get("origin") !== url.origin) {
      return null;
    }

    const fetchSite = request.headers.get("sec-fetch-site");

    if (
      fetchSite &&
      !["same-origin", "none"].includes(fetchSite)
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function apiUrl(path: string): string {
  return (
    getNestApiUrl().replace(/\/+$/, "") +
    "/api/v1/admin/media" +
    path
  );
}

function cookie(token: string): string {
  return `${getAdminCookieName()}=${token}`;
}

async function csrfToken(token: string): Promise<string> {
  const response = await fetch(
    getNestApiUrl().replace(/\/+$/, "") +
      "/api/v1/admin/auth/csrf",
    {
      method: "GET",
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
    throw new Error("CSRF request failed.");
  }

  const body: unknown = await response.json();

  if (
    !isRecord(body) ||
    !isRecord(body.data) ||
    typeof body.data.csrfToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.data.csrfToken)
  ) {
    throw new Error("Invalid CSRF response.");
  }

  return body.data.csrfToken;
}

async function relay(response: Response) {
  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    return failure("Unexpected backend redirect.", 502);
  }

  if (
    !(response.headers.get("content-type") ?? "")
      .includes("application/json")
  ) {
    return failure("Invalid backend response.", 502);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return failure("Invalid backend JSON.", 502);
  }

  if (
    !isRecord(body) ||
    typeof body.success !== "boolean"
  ) {
    return failure("Invalid backend response.", 502);
  }

  if (response.status < 200 || response.status > 599) {
    return failure("Invalid backend status.", 502);
  }

  return reply(body, response.status);
}

export async function GET(request: NextRequest) {
  const token = await getAdminSessionToken();

  if (!token) {
    return failure("Authentication required.", 401);
  }

  const id = mediaIdSchema.safeParse(
    request.nextUrl.searchParams.get("id"),
  );

  if (!id.success) {
    return failure("Invalid media ID.", 400);
  }

  const mode = request.nextUrl.searchParams.get("mode");

  if (mode !== null && mode !== "activity") {
    return failure("Invalid metadata mode.", 400);
  }

  const path =
    `/${encodeURIComponent(id.data)}` +
    (mode === "activity" ? "/activity" : "");

  try {
    const response = await fetch(apiUrl(path), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: cookie(token),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    return relay(response);
  } catch {
    return failure("Media service unavailable.", 502);
  }
}

export async function PATCH(request: NextRequest) {
  const origin = originAllowed(request);

  if (!origin) {
    return failure("Request origin not allowed.", 403);
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure("Authentication required.", 401);
  }

  const id = mediaIdSchema.safeParse(
    request.nextUrl.searchParams.get("id"),
  );

  if (!id.success) {
    return failure("Invalid media ID.", 400);
  }

  if (
    !(
      request.headers.get("content-type") ?? ""
    ).toLowerCase().startsWith("application/json")
  ) {
    return failure("JSON body required.", 415);
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (raw.length > 2048) {
      return failure("Request body too large.", 413);
    }

    body = JSON.parse(raw);
  } catch {
    return failure("Invalid JSON body.", 400);
  }

  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(
      {
        success: false,
        message: "Invalid media metadata.",
        errors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const csrf = await csrfToken(token);

    const response = await fetch(
      apiUrl(`/${encodeURIComponent(id.data)}`),
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Cookie: cookie(token),
          Origin: origin,
          "x-csrf-token": csrf,
        },
        body: JSON.stringify(parsed.data),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      },
    );

    return relay(response);
  } catch {
    return failure(
      "Update result unknown. Refresh media details before retrying.",
      502,
    );
  }
}
