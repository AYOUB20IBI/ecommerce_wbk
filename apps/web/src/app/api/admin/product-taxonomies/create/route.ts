
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const uuid = z.uuid();

const schema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("categories"),
    name: z.string().trim().min(2).max(150),
    slug: z.string().regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    ).min(2).max(150),
    parentId: uuid.nullable(),
  }),
  z.strictObject({
    kind: z.literal("tags"),
    name: z.string().trim().min(2).max(150),
    slug: z.string().regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    ).min(2).max(150),
  }),
  z.strictObject({
    kind: z.literal("brands"),
    name: z.string().trim().min(2).max(150),
    slug: z.string().regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    ).min(2).max(150),
  }),
]);

function respond(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function appOrigin(): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) return null;

  try {
    const url = new URL(configured);

    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

async function json(response: Response): Promise<unknown> {
  if (
    !response.headers
      .get("content-type")
      ?.includes("application/json")
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function POST(request: NextRequest) {
  const origin = appOrigin();

  if (
    !origin ||
    request.headers.get("origin") !== origin
  ) {
    return respond({
      success: false,
      message: "Invalid request origin.",
    }, 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    fetchSite &&
    !["same-origin", "none"].includes(fetchSite)
  ) {
    return respond({
      success: false,
      message: "Cross-site requests are not allowed.",
    }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.startsWith("application/json")) {
    return respond({
      success: false,
      message: "JSON content type is required.",
    }, 415);
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return respond({
      success: false,
      message: "Authentication required.",
    }, 401);
  }

  const declaredLength = request.headers.get("content-length");

  if (
    declaredLength !== null &&
    Number(declaredLength) > 4096
  ) {
    return respond({
      success: false,
      message: "Request body too large.",
    }, 413);
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (raw.length > 4096) {
      return respond({
        success: false,
        message: "Request body too large.",
      }, 413);
    }

    body = JSON.parse(raw);
  } catch {
    return respond({
      success: false,
      message: "Invalid JSON body.",
    }, 400);
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return respond({
      success: false,
      message: "Invalid taxonomy details.",
      errors: z.flattenError(parsed.error),
    }, 400);
  }

  const backendUrl = getNestApiUrl().replace(/\/+$/, "");

  const cookie = `${getAdminCookieName()}=${token}`;

  try {
    const csrfResponse = await fetch(
      `${backendUrl}/api/v1/admin/auth/csrf`,
      {
        method: "GET",
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      },
    );

    const csrfBody = await json(csrfResponse);

    if (
      !csrfResponse.ok ||
      !isRecord(csrfBody) ||
      !isRecord(csrfBody.data) ||
      typeof csrfBody.data.csrfToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(csrfBody.data.csrfToken)
    ) {
      return respond({
        success: false,
        message: "Unable to verify CSRF protection.",
      }, csrfResponse.status === 401 ? 401 : 502);
    }

    const { kind, ...fields } = parsed.data;

    const backendResponse = await fetch(
      `${backendUrl}/api/v1/admin/${kind}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-csrf-token": csrfBody.data.csrfToken,
        },
        body: JSON.stringify(fields),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      },
    );

    if (
      backendResponse.status >= 300 &&
      backendResponse.status < 400
    ) {
      return respond({
        success: false,
        message: "Unexpected backend redirect.",
      }, 502);
    }

    const result = await json(backendResponse);

    if (!isRecord(result)) {
      return respond({
        success: false,
        message: "Invalid taxonomy API response.",
      }, 502);
    }

    return respond(result, backendResponse.status);
  } catch {
    return respond({
      success: false,
      message: "Taxonomy service unavailable.",
    }, 502);
  }
}
