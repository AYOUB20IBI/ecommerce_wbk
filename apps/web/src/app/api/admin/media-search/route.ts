
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const querySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000),
  limit: z.coerce.number().int().min(1).max(100),
  search: z.string().trim().max(150),
  type: z.enum(["all", "image", "document"]),
});

function reply(value: unknown, status: number) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = await getAdminSessionToken();

  if (!token) {
    return reply(
      { success: false, message: "Authentication required." },
      401,
    );
  }

  const params = request.nextUrl.searchParams;

  const parsed = querySchema.safeParse({
    page: params.get("page") ?? "1",
    limit: params.get("limit") ?? "24",
    search: params.get("search") ?? "",
    type: params.get("type") ?? "all",
  });

  if (!parsed.success) {
    return reply(
      { success: false, message: "Invalid media search." },
      400,
    );
  }

  const query = new URLSearchParams({
    page: String(parsed.data.page),
    limit: String(parsed.data.limit),
    search: parsed.data.search,
    type: parsed.data.type,
  });

  try {
    const response = await fetch(
      `${getNestApiUrl().replace(/\/+$/, "")}/api/v1/admin/media/search?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Cookie: `${getAdminCookieName()}=${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      },
    );

    if (response.status >= 300 && response.status < 400) {
      return reply(
        { success: false, message: "Unexpected redirect." },
        502,
      );
    }

    if (
      !(
        response.headers.get("content-type") ?? ""
      ).includes("application/json")
    ) {
      return reply(
        { success: false, message: "Invalid API response." },
        502,
      );
    }

    const result: unknown = await response.json();

    if (
      !result ||
      typeof result !== "object" ||
      !("success" in result) ||
      typeof result.success !== "boolean"
    ) {
      return reply(
        { success: false, message: "Invalid API response." },
        502,
      );
    }

    return reply(result, response.status);
  } catch {
    return reply(
      { success: false, message: "Media search unavailable." },
      502,
    );
  }
}
