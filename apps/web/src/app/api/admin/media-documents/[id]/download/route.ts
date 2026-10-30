
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

const mediaIdSchema = z.uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

function error(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const token = await getAdminSessionToken();

  if (!token) {
    return error("Authentication required.", 401);
  }

  const { id } = await context.params;
  const parsed = mediaIdSchema.safeParse(id);

  if (!parsed.success) {
    return error("Invalid media ID.", 400);
  }

  try {
    const response = await fetch(
      `${getNestApiUrl()}/api/v1/admin/media/${encodeURIComponent(
        parsed.data,
      )}/download`,
      {
        method: "GET",
        headers: {
          Cookie: `${getAdminCookieName()}=${token}`,
          Accept: "application/octet-stream",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      },
    );

    if (!response.ok) {
      const status = response.status;

      if ([400, 401, 403, 404].includes(status)) {
        return error("Document unavailable or unauthorized.", status);
      }

      return error("Document download failed.", 502);
    }

    if (!response.body) {
      return error("Empty document response.", 502);
    }

    const disposition =
      response.headers.get("content-disposition") ?? "";

    const safeDisposition =
      disposition.startsWith("attachment;") &&
      disposition.length <= 500 &&
      !/[\r\n\x00-\x1F\x7F]/.test(disposition)
        ? disposition
        : 'attachment; filename="document"';

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": safeDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; sandbox",
      },
    });
  } catch {
    return error("Document service unavailable.", 502);
  }
}
