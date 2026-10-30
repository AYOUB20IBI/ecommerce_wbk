
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

const MAX_BYTES = 5 * 1024 * 1024;

const TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const mediaId = z.uuid();

const externalSchema = z.strictObject({
  url: z.url().max(2048).refine((value) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();

      return (
        ["http:", "https:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password &&
        !parsed.hash &&
        !parsed.port &&
        host.includes(".") &&
        host !== "localhost" &&
        !host.endsWith(".localhost") &&
        !host.endsWith(".local") &&
        !host.endsWith(".internal") &&
        !host.endsWith(".test") &&
        !host.endsWith(".invalid") &&
        !host.endsWith(".example") &&
        !host.endsWith(".onion") &&
        !host.endsWith(".arpa") &&
        !host.includes(":") &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(host) &&
        host.split(".").every(
          (part) =>
            /^[a-z0-9-]+$/.test(part) &&
            !part.startsWith("-") &&
            !part.endsWith("-"),
        )
      );
    } catch {
      return false;
    }
  }),
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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function authorizedOrigin(
  request: NextRequest,
): string | null {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) return null;

  try {
    const url = new URL(configured);

    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(
          url.hostname,
        )
      )
    ) {
      return null;
    }

    const origin = url.origin;

    if (request.headers.get("origin") !== origin) {
      return null;
    }

    const site = request.headers.get("sec-fetch-site");

    if (site && !["same-origin", "none"].includes(site)) {
      return null;
    }

    return origin;
  } catch {
    return null;
  }
}

function serviceUrl(path: string): string {
  return (
    getNestApiUrl().replace(/\/+$/, "") +
    "/api/v1/admin/media" +
    path
  );
}

function sessionCookie(token: string): string {
  return `${getAdminCookieName()}=${token}`;
}

async function readJson(
  response: Response,
): Promise<unknown> {
  if (
    !(response.headers.get("content-type") ?? "")
      .includes("application/json")
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fromBackend(body: unknown, status: number) {
  if (status === 204) {
    return reply(
      { success: true, data: { completed: true } },
      200,
    );
  }

  if (
    (status >= 300 && status < 400) ||
    !isRecord(body)
  ) {
    return reply(
      {
        success: false,
        message: "Invalid Media API response.",
      },
      502,
    );
  }

  return reply(body, status);
}

async function forward(
  path: string,
  token: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    origin?: string;
    csrf?: string;
    body?: BodyInit;
    contentType?: string;
  } = {},
): Promise<Response> {
  const headers = new Headers({
    Accept: "application/json",
    Cookie: sessionCookie(token),
  });

  if (options.origin) {
    headers.set("Origin", options.origin);
  }

  if (options.csrf) {
    headers.set("x-csrf-token", options.csrf);
  }

  if (options.contentType) {
    headers.set("Content-Type", options.contentType);
  }

  return fetch(serviceUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
}

async function getCsrf(
  token: string,
): Promise<string> {
  const response = await fetch(
    getNestApiUrl().replace(/\/+$/, "") +
      "/api/v1/admin/auth/csrf",
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: sessionCookie(token),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    },
  );

  const body = await readJson(response);

  if (
    !response.ok ||
    !isRecord(body) ||
    !isRecord(body.data) ||
    typeof body.data.csrfToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.data.csrfToken)
  ) {
    throw new Error("CSRF verification failed.");
  }

  return body.data.csrfToken;
}

export async function GET(
  request: NextRequest,
) {
  const token = await getAdminSessionToken();

  if (!token) {
    return reply(
      {
        success: false,
        message: "Authentication required.",
      },
      401,
    );
  }

  const requestedId =
    request.nextUrl.searchParams.get("id");

  let path: string;

  if (requestedId !== null) {
    const parsed = mediaId.safeParse(requestedId);

    if (!parsed.success) {
      return reply(
        {
          success: false,
          message: "Invalid media ID.",
        },
        400,
      );
    }

    path = `/${encodeURIComponent(parsed.data)}`;
  } else {
    const page = z.coerce.number().int().min(1).max(100000)
      .safeParse(
        request.nextUrl.searchParams.get("page") ?? "1",
      );

    const limit = z.coerce.number().int().min(1).max(100)
      .safeParse(
        request.nextUrl.searchParams.get("limit") ?? "24",
      );

    if (!page.success || !limit.success) {
      return reply(
        {
          success: false,
          message: "Invalid pagination.",
        },
        400,
      );
    }

    const params = new URLSearchParams({
      page: String(page.data),
      limit: String(limit.data),
    });

    path = `?${params.toString()}`;
  }

  try {
    const response = await forward(path, token);

    return fromBackend(
      await readJson(response),
      response.status,
    );
  } catch {
    return reply(
      {
        success: false,
        message: "Media service unavailable.",
      },
      502,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  const origin = authorizedOrigin(request);

  if (!origin) {
    return reply(
      {
        success: false,
        message: "Request origin not allowed.",
      },
      403,
    );
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return reply(
      {
        success: false,
        message: "Authentication required.",
      },
      401,
    );
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  try {
    let path: string;
    let body: BodyInit;
    let outgoingContentType: string | undefined;

    if (contentType.startsWith("application/json")) {
      const raw = await request.text();

      if (raw.length > 5000) {
        return reply(
          {
            success: false,
            message: "Request body is too large.",
          },
          413,
        );
      }

      let parsedBody: unknown;

      try {
        parsedBody = JSON.parse(raw);
      } catch {
        return reply(
          {
            success: false,
            message: "Invalid JSON.",
          },
          400,
        );
      }

      const parsed = externalSchema.safeParse(
        parsedBody,
      );

      if (!parsed.success) {
        return reply(
          {
            success: false,
            message:
              "Enter a valid public HTTP or HTTPS image URL.",
          },
          400,
        );
      }

      path = "/external";
      body = JSON.stringify(parsed.data);
      outgoingContentType = "application/json";
    } else if (
      contentType.startsWith("multipart/form-data")
    ) {
      const length = request.headers.get("content-length");

      if (
        length !== null &&
        (!Number.isFinite(Number(length)) ||
          Number(length) > MAX_BYTES + 16384)
      ) {
        return reply(
          {
            success: false,
            message: "Upload exceeds size limit.",
          },
          413,
        );
      }

      const form = await request.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return reply(
          {
            success: false,
            message: "Image file required.",
          },
          400,
        );
      }

      if (
        file.size === 0 ||
        file.size > MAX_BYTES ||
        !TYPES.has(file.type)
      ) {
        return reply(
          {
            success: false,
            message:
              "Select JPEG, PNG or WebP up to 5 MB.",
          },
          400,
        );
      }

      const outgoing = new FormData();
      outgoing.set("file", file, file.name);

      path = "/upload";
      body = outgoing;
    } else {
      return reply(
        {
          success: false,
          message: "Unsupported content type.",
        },
        415,
      );
    }

    const csrf = await getCsrf(token);

    const response = await forward(path, token, {
      method: "POST",
      origin,
      csrf,
      body,
      contentType: outgoingContentType,
    });

    return fromBackend(
      await readJson(response),
      response.status,
    );
  } catch {
    return reply(
      {
        success: false,
        message:
          "Media operation failed. Check the library before retrying.",
      },
      502,
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  const origin = authorizedOrigin(request);

  if (!origin) {
    return reply(
      {
        success: false,
        message: "Request origin not allowed.",
      },
      403,
    );
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return reply(
      {
        success: false,
        message: "Authentication required.",
      },
      401,
    );
  }

  const id = mediaId.safeParse(
    request.nextUrl.searchParams.get("id"),
  );

  if (!id.success) {
    return reply(
      {
        success: false,
        message: "Invalid media ID.",
      },
      400,
    );
  }

  try {
    const csrf = await getCsrf(token);

    const response = await forward(
      `/${encodeURIComponent(id.data)}`,
      token,
      {
        method: "DELETE",
        origin,
        csrf,
      },
    );

    return fromBackend(
      await readJson(response),
      response.status,
    );
  } catch {
    return reply(
      {
        success: false,
        message:
          "Deletion result is unknown. Refresh the library before retrying.",
      },
      502,
    );
  }
}
