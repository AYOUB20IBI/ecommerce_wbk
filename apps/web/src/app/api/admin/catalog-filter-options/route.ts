
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

type Kind = "categories" | "tags" | "brands";

const KINDS = new Set<Kind>([
  "categories",
  "tags",
  "brands",
]);

type TaxonomyItem = {
  id: string;
  name: string;
  slug?: string;
};

type TaxonomyResponse = {
  success?: boolean;
  data?: unknown;
};

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(request: NextRequest) {
  const rawKind = request.nextUrl.searchParams.get("kind");

  if (!rawKind || !KINDS.has(rawKind as Kind)) {
    return failure(400, "Invalid taxonomy.");
  }

  const kind = rawKind as Kind;
  const search =
    request.nextUrl.searchParams.get("search")?.trim() ?? "";

  if (search.length > 100) {
    return failure(400, "Search is too long.");
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  try {
    const endpoint = new URL(
      `${getNestApiUrl()}/api/v1/admin/${kind}`,
    );

    endpoint.searchParams.set("page", "1");
    endpoint.searchParams.set("limit", "50");

    if (search) {
      endpoint.searchParams.set("search", search);
    }

    const upstream = await fetch(endpoint, {
      headers: {
        Cookie: `${getAdminCookieName()}=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
    });

    if (upstream.status === 401) {
      return failure(401, "Session expired.");
    }

    if (upstream.status === 403) {
      return failure(
        403,
        `Missing ${kind}.read permission.`,
      );
    }

    if (!upstream.ok) {
      return failure(
        502,
        "Taxonomy service unavailable.",
      );
    }

    const body =
      (await upstream.json()) as TaxonomyResponse;

    if (body.success !== true) {
      return failure(502, "Invalid taxonomy response.");
    }

    // TaxonomyService.findAll returns its paginated
    // payload as data; support items-based pagination
    // and a direct array without fabricating records.
    const source = body.data;

    let rawItems: unknown = [];

    if (Array.isArray(source)) {
      rawItems = source;
    } else if (
      source &&
      typeof source === "object" &&
      "items" in source
    ) {
      rawItems = source.items;
    }

    if (!Array.isArray(rawItems)) {
      return failure(
        502,
        "Unexpected taxonomy data format.",
      );
    }

    const items: TaxonomyItem[] = rawItems
      .filter(
        (item): item is TaxonomyItem =>
          Boolean(
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.name === "string",
          ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        slug: typeof item.slug === "string"
          ? item.slug
          : undefined,
      }));

    return NextResponse.json(
      {
        success: true,
        data: {
          items,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return failure(
      503,
      "Taxonomy service temporarily unavailable.",
    );
  }
}
