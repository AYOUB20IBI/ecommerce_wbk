
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

const uuid = z.uuid();

const addSchema = z.strictObject({
  action: z.literal("attach"),
  mediaId: uuid,
  isFeatured: z.boolean(),
  position: z.number().int().min(0).max(1000000).optional(),
});

const featureSchema = z.strictObject({
  imageId: uuid,
});

const orderSchema = z.strictObject({
  imageIds: z.array(uuid)
    .max(1000)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate image IDs are not allowed.",
    ),
});

function reply(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function appOrigin(): string | null {
  const value = process.env.ADMIN_APP_ORIGIN;
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" ||
      (
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    ) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function writeOrigin(request: NextRequest): string | null {
  const origin = appOrigin();

  if (!origin || request.headers.get("origin") !== origin) {
    return null;
  }

  const site = request.headers.get("sec-fetch-site");

  if (site && !["same-origin", "none"].includes(site)) {
    return null;
  }

  return origin;
}

async function readJson(response: Response): Promise<unknown> {
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

async function readBody(request: NextRequest): Promise<unknown> {
  if (
    !(request.headers.get("content-type") ?? "")
      .startsWith("application/json")
  ) {
    throw new Error("JSON required.");
  }

  const length = request.headers.get("content-length");

  if (
    length !== null &&
    (!Number.isFinite(Number(length)) ||
      Number(length) > 40000)
  ) {
    throw new Error("Body too large.");
  }

  const raw = await request.text();

  if (raw.length > 40000) {
    throw new Error("Body too large.");
  }

  return JSON.parse(raw) as unknown;
}

async function getId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  const result = uuid.safeParse(id);
  return result.success ? result.data : null;
}

function backendUrl(path: string): string {
  return `${getNestApiUrl().replace(/\/+$/, "")}/api/v1${path}`;
}

async function forward(
  path: string,
  session: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    origin?: string;
    csrf?: string;
  } = {},
): Promise<Response> {
  const headers = new Headers({
    Accept: "application/json",
    Cookie: `${getAdminCookieName()}=${session}`,
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.origin) {
    headers.set("Origin", options.origin);
  }

  if (options.csrf) {
    headers.set("x-csrf-token", options.csrf);
  }

  return fetch(backendUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
}

async function csrfToken(session: string): Promise<string> {
  const response = await forward("/admin/auth/csrf", session);
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

function upstream(body: unknown, status: number) {
  if (status === 204) {
    return reply(
      { success: true, data: { completed: true } },
      200,
    );
  }

  if (status >= 300 && status < 400) {
    return reply(
      { success: false, message: "Unexpected redirect." },
      502,
    );
  }

  if (!isRecord(body)) {
    return reply(
      { success: false, message: "Invalid backend response." },
      502,
    );
  }

  return reply(body, status);
}

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  const id = await getId(context);

  if (!id) {
    return reply(
      { success: false, message: "Invalid product ID." },
      400,
    );
  }

  const session = await getAdminSessionToken();

  if (!session) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  try {
    const response = await forward(
      `/admin/products/${id}/images`,
      session,
    );

    return upstream(await readJson(response), response.status);
  } catch {
    return reply(
      { success: false, message: "Unable to load images." },
      502,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  const origin = writeOrigin(request);

  if (!origin) {
    return reply(
      { success: false, message: "Origin not allowed." },
      403,
    );
  }

  const id = await getId(context);

  if (!id) {
    return reply(
      { success: false, message: "Invalid product ID." },
      400,
    );
  }

  const session = await getAdminSessionToken();

  if (!session) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  let input: z.infer<typeof addSchema>;

  try {
    const parsed = addSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return reply(
        { success: false, message: "Invalid image details." },
        400,
      );
    }

    input = parsed.data;
  } catch {
    return reply(
      { success: false, message: "Invalid JSON." },
      400,
    );
  }

  try {
    const csrf = await csrfToken(session);

    const response = await forward(
      `/admin/products/${id}/images`,
      session,
      {
        method: "POST",
        origin,
        csrf,
        body: {
          mediaId: input.mediaId,
          isFeatured: input.isFeatured,
          ...(input.position === undefined
            ? {}
            : { position: input.position }),
        },
      },
    );

    return upstream(await readJson(response), response.status);
  } catch {
    return reply(
      {
        success: false,
        message: "Unable to attach image. Refresh the gallery before retrying.",
      },
      502,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  const origin = writeOrigin(request);

  if (!origin) {
    return reply(
      { success: false, message: "Origin not allowed." },
      403,
    );
  }

  const id = await getId(context);

  if (!id) {
    return reply(
      { success: false, message: "Invalid product ID." },
      400,
    );
  }

  const session = await getAdminSessionToken();

  if (!session) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  try {
    const parsed = featureSchema.safeParse(
      await readBody(request),
    );

    if (!parsed.success) {
      return reply(
        { success: false, message: "Invalid image ID." },
        400,
      );
    }

    const csrf = await csrfToken(session);

    const response = await forward(
      `/admin/products/${id}/images/${parsed.data.imageId}`,
      session,
      {
        method: "PATCH",
        origin,
        csrf,
        body: { isFeatured: true },
      },
    );

    return upstream(await readJson(response), response.status);
  } catch {
    return reply(
      { success: false, message: "Unable to set featured image." },
      502,
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: Context,
) {
  const origin = writeOrigin(request);

  if (!origin) {
    return reply(
      { success: false, message: "Origin not allowed." },
      403,
    );
  }

  const id = await getId(context);

  if (!id) {
    return reply(
      { success: false, message: "Invalid product ID." },
      400,
    );
  }

  const session = await getAdminSessionToken();

  if (!session) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  try {
    const parsed = orderSchema.safeParse(
      await readBody(request),
    );

    if (!parsed.success) {
      return reply(
        { success: false, message: "Invalid gallery order." },
        400,
      );
    }

    const csrf = await csrfToken(session);

    const response = await forward(
      `/admin/products/${id}/images/order`,
      session,
      {
        method: "PUT",
        origin,
        csrf,
        body: parsed.data,
      },
    );

    return upstream(await readJson(response), response.status);
  } catch {
    return reply(
      { success: false, message: "Unable to reorder images." },
      502,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context,
) {
  const origin = writeOrigin(request);

  if (!origin) {
    return reply(
      { success: false, message: "Origin not allowed." },
      403,
    );
  }

  const id = await getId(context);

  if (!id) {
    return reply(
      { success: false, message: "Invalid product ID." },
      400,
    );
  }

  const session = await getAdminSessionToken();

  if (!session) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  const imageId = uuid.safeParse(
    request.nextUrl.searchParams.get("imageId"),
  );

  if (!imageId.success) {
    return reply(
      { success: false, message: "Invalid image ID." },
      400,
    );
  }

  try {
    const csrf = await csrfToken(session);

    const response = await forward(
      `/admin/products/${id}/images/${imageId.data}`,
      session,
      {
        method: "DELETE",
        origin,
        csrf,
      },
    );

    return upstream(await readJson(response), response.status);
  } catch {
    return reply(
      { success: false, message: "Unable to remove image." },
      502,
    );
  }
}
