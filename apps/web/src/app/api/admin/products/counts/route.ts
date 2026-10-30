
import { NextResponse } from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

type Counts = {
  all: number;
  published: number;
  draft: number;
  private: number;
  trash: number;
};

type CountsResponse = {
  success: boolean;
  message?: string;
  data?: Counts;
};

function failure(status: number, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function validCounts(value: unknown): value is Counts {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return [
    "all",
    "published",
    "draft",
    "private",
    "trash",
  ].every((key) => {
    const count = record[key];

    return (
      typeof count === "number" &&
      Number.isSafeInteger(count) &&
      count >= 0
    );
  });
}

export async function GET() {
  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  try {
    const endpoint = new URL(
      "/api/v1/admin/products/counts",
      getNestApiUrl(),
    );

    const upstream = await fetch(endpoint, {
      method: "GET",
      headers: {
        Cookie: `${getAdminCookieName()}=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401) {
      return failure(401, "Admin session expired.");
    }

    if (upstream.status === 403) {
      return failure(
        403,
        "products.read permission required.",
      );
    }

    if (
      upstream.status >= 300 &&
      upstream.status < 400
    ) {
      return failure(502, "Unexpected API redirect.");
    }

    if (!upstream.ok) {
      return failure(
        502,
        "Product counters service unavailable.",
      );
    }

    const raw = await upstream.text();

    if (raw.length > 10000) {
      return failure(502, "Unexpected response size.");
    }

    let result: CountsResponse;

    try {
      result = JSON.parse(raw) as CountsResponse;
    } catch {
      return failure(502, "Invalid counters response.");
    }

    if (
      result.success !== true ||
      !validCounts(result.data)
    ) {
      return failure(502, "Invalid counters data.");
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return failure(
      503,
      "Product counters temporarily unavailable.",
    );
  }
}
