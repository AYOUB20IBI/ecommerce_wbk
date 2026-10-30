
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const productIdSchema = z.uuid();

const uniqueIds = z
  .array(z.uuid())
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate IDs are not allowed.",
  });

const updateSchema = z.strictObject({
  categoryIds: uniqueIds.optional(),
  tagIds: uniqueIds.optional(),
  brandId: z.uuid().nullable().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function respond(
  data: unknown,
  status: number,
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getAppOrigin(): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) {
    return null;
  }

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

function isSameOriginRequest(
  request: NextRequest,
  trustedOrigin: string,
): boolean {
  const origin = request.headers.get("origin");

  if (origin !== trustedOrigin) {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    return false;
  }

  return true;
}

async function readJson(
  response: Response,
): Promise<unknown> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchBackend(
  path: string,
  sessionToken: string,
  options: {
    method?: "GET" | "PATCH";
    body?: string;
    csrfToken?: string;
    origin?: string;
  } = {},
): Promise<Response> {
  const headers = new Headers();

  headers.set("Accept", "application/json");
  headers.set(
    "Cookie",
    `${getAdminCookieName()}=${sessionToken}`,
  );

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.csrfToken) {
    headers.set("x-csrf-token", options.csrfToken);
  }

  if (options.origin) {
    headers.set("Origin", options.origin);
  }

  const baseUrl = getNestApiUrl().replace(/\/+$/, "");

  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
}

async function resolveSession(): Promise<string | null> {
  return getAdminSessionToken();
}

async function parseProductId(
  context: RouteContext,
): Promise<string | null> {
  const params = await context.params;
  const result = productIdSchema.safeParse(params.id);

  return result.success ? result.data : null;
}

function upstreamResult(
  body: unknown,
  status: number,
): NextResponse {
  if (
    status >= 300 &&
    status < 400
  ) {
    return respond(
      {
        success: false,
        message: "Unexpected backend redirect.",
      },
      502,
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return respond(
      {
        success: false,
        message: "Invalid backend response.",
      },
      502,
    );
  }

  return respond(body, status);
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const id = await parseProductId(context);

  if (!id) {
    return respond(
      {
        success: false,
        message: "Invalid product ID.",
      },
      400,
    );
  }

  const sessionToken = await resolveSession();

  if (!sessionToken) {
    return respond(
      {
        success: false,
        message: "Authentication required.",
      },
      401,
    );
  }

  try {
    const backend = await fetchBackend(
      `/api/v1/admin/products/${encodeURIComponent(id)}/taxonomies`,
      sessionToken,
    );

    return upstreamResult(
      await readJson(backend),
      backend.status,
    );
  } catch {
    return respond(
      {
        success: false,
        message: "Taxonomy service unavailable.",
      },
      502,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const trustedOrigin = getAppOrigin();

  if (
    !trustedOrigin ||
    !isSameOriginRequest(request, trustedOrigin)
  ) {
    return respond(
      {
        success: false,
        message: "Request origin not allowed.",
      },
      403,
    );
  }

  const id = await parseProductId(context);

  if (!id) {
    return respond(
      {
        success: false,
        message: "Invalid product ID.",
      },
      400,
    );
  }

  const sessionToken = await resolveSession();

  if (!sessionToken) {
    return respond(
      {
        success: false,
        message: "Authentication required.",
      },
      401,
    );
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.startsWith("application/json")) {
    return respond(
      {
        success: false,
        message: "JSON content type required.",
      },
      415,
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (
    !Number.isFinite(declaredLength) ||
    declaredLength > 12000
  ) {
    return respond(
      {
        success: false,
        message: "Request body is too large.",
      },
      413,
    );
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return respond(
      {
        success: false,
        message: "Unable to read request body.",
      },
      400,
    );
  }

  if (rawBody.length > 12000) {
    return respond(
      {
        success: false,
        message: "Request body is too large.",
      },
      413,
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return respond(
      {
        success: false,
        message: "Invalid JSON.",
      },
      400,
    );
  }

  const validated = updateSchema.safeParse(body);

  if (
    !validated.success ||
    Object.keys(validated.data).length === 0
  ) {
    return respond(
      {
        success: false,
        message: "Invalid taxonomy selection.",
      },
      400,
    );
  }

  try {
    // The CSRF token is generated by NestJS and bound
    // to this admin session. It is never exposed to
    // the browser by this route.
    const csrfResponse = await fetchBackend(
      "/api/v1/admin/auth/csrf",
      sessionToken,
    );

    const csrfBody = await readJson(csrfResponse);

    if (
      !csrfResponse.ok ||
      !csrfBody ||
      typeof csrfBody !== "object" ||
      !("data" in csrfBody)
    ) {
      return respond(
        {
          success: false,
          message: "Unable to validate admin session.",
        },
        csrfResponse.status === 401 ? 401 : 502,
      );
    }

    const csrfData = csrfBody.data;

    if (
      !csrfData ||
      typeof csrfData !== "object" ||
      !("csrfToken" in csrfData) ||
      typeof csrfData.csrfToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(csrfData.csrfToken)
    ) {
      return respond(
        {
          success: false,
          message: "Invalid CSRF token response.",
        },
        502,
      );
    }

    const backend = await fetchBackend(
      `/api/v1/admin/products/${encodeURIComponent(id)}/taxonomies`,
      sessionToken,
      {
        method: "PATCH",
        body: JSON.stringify(validated.data),
        csrfToken: csrfData.csrfToken,
        origin: trustedOrigin,
      },
    );

    return upstreamResult(
      await readJson(backend),
      backend.status,
    );
  } catch {
    return respond(
      {
        success: false,
        message: "Unable to update product taxonomies.",
      },
      502,
    );
  }
}
