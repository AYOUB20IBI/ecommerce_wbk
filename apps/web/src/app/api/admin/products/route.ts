import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

const ALLOWED_PARAMS = new Set([
  "page",
  "limit",
  "search",
  "status",
  "type",
  "categoryId",
  "brandId",
  "tagId",
  "attributeId",
  "valueId",
  "minPrice",
  "maxPrice",
  "stockStatus",
  "isFeatured",
  "trash",
  "sortBy",
  "sortOrder",
]);

type ProductItem = {
  id: string;
  [key: string]: unknown;
};

type TaxonomyItem = {
  id: string;
  name: string;
};

type ProductTaxonomies = {
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
};

type ListData = {
  items: ProductItem[];
  pagination: unknown;
};

type ListResult = {
  success: boolean;
  message?: string;
  data?: ListData;
};

type TaxonomyResult = {
  success: boolean;
  data?: Record<string, ProductTaxonomies>;
};

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function failure(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: NO_STORE },
  );
}

function getOrigin(): string {
  const raw = process.env.ADMIN_APP_ORIGIN;

  if (!raw) {
    throw new Error("ADMIN_APP_ORIGIN is missing.");
  }

  const url = new URL(raw);

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN.");
  }

  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(
      url.hostname,
    );

  if (url.protocol !== "https:" && !local) {
    throw new Error("HTTPS required outside localhost.");
  }

  return url.origin;
}

function getCookie(token: string) {
  return `${getAdminCookieName()}=${token}`;
}

function validList(value: unknown): value is ListResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Partial<ListResult>;

  return (
    body.success === true &&
    Boolean(body.data) &&
    Array.isArray(body.data?.items) &&
    Boolean(body.data?.pagination) &&
    body.data!.items.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string",
    )
  );
}

function validTaxonomies(
  value: unknown,
): value is TaxonomyResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<TaxonomyResult>;

  return (
    data.success === true &&
    Boolean(data.data) &&
    typeof data.data === "object"
  );
}

export async function GET(request: NextRequest) {
  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  const query = new URLSearchParams();

  for (const [key, value] of request.nextUrl.searchParams) {
    if (!ALLOWED_PARAMS.has(key) || query.has(key)) {
      return failure(400, "Invalid product filter.");
    }

    query.set(key, value);
  }

  try {
    const base = getNestApiUrl();
    const cookie = getCookie(token);

    const endpoint = new URL(
      "/api/v1/admin/products",
      base,
    );

    endpoint.search = query.toString();

    const upstream = await fetch(endpoint, {
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });

    if (upstream.status === 401) {
      return failure(401, "Session expired.");
    }

    if (upstream.status === 403) {
      return failure(403, "Permission denied.");
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected API redirect.");
    }

    const raw = await upstream.text();

    if (raw.length > 2_000_000) {
      return failure(502, "Products response too large.");
    }

    let result: unknown;

    try {
      result = JSON.parse(raw);
    } catch {
      return failure(502, "Invalid products response.");
    }

    if (!upstream.ok) {
      return NextResponse.json(result, {
        status: upstream.status,
        headers: NO_STORE,
      });
    }

    if (!validList(result)) {
      return failure(502, "Invalid products data.");
    }

    const ids = result.data!.items.map(
      (product) => product.id,
    );

    if (ids.length > 0) {
      const taxonomyUrl = new URL(
        "/api/v1/admin/products/list-taxonomies",
        base,
      );

      taxonomyUrl.searchParams.set(
        "ids",
        ids.join(","),
      );

      const taxonomyResponse = await fetch(taxonomyUrl, {
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });

      if (!taxonomyResponse.ok) {
        return failure(
          taxonomyResponse.status === 401 ? 401 : 502,
          "Product taxonomy data unavailable.",
        );
      }

      const taxonomyResult: unknown =
        await taxonomyResponse.json();

      if (!validTaxonomies(taxonomyResult)) {
        return failure(502, "Invalid taxonomy data.");
      }

      const taxonomies = taxonomyResult.data!;

      result.data!.items = result.data!.items.map(
        (product) => {
          const found = taxonomies[product.id];

          if (
            !found ||
            !Array.isArray(found.categories) ||
            !Array.isArray(found.tags)
          ) {
            throw new Error("Incomplete taxonomy data.");
          }

          return {
            ...product,
            categories: found.categories,
            tags: found.tags,
          };
        },
      );
    }

    return NextResponse.json(result, {
      headers: NO_STORE,
    });
  } catch {
    return failure(
      503,
      "Products service temporarily unavailable.",
    );
  }
}

export async function POST(request: NextRequest) {
  let origin: string;

  try {
    origin = getOrigin();
  } catch {
    return failure(500, "Admin origin not configured.");
  }

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    request.nextUrl.origin !== origin ||
    request.headers.get("origin") !== origin ||
    (
      fetchSite !== null &&
      fetchSite !== "same-origin" &&
      fetchSite !== "none"
    )
  ) {
    return failure(403, "Origin not allowed.");
  }

  if (
    request.headers.get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  ) {
    return failure(415, "JSON required.");
  }

  const token = await getAdminSessionToken();

  if (!token) {
    return failure(401, "Authentication required.");
  }

  const raw = await request.text();

  if (
    new TextEncoder().encode(raw).length > 1_000_000
  ) {
    return failure(413, "Payload too large.");
  }

  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    return failure(400, "Invalid JSON.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return failure(400, "Invalid product payload.");
  }

  try {
    const base = getNestApiUrl();
    const cookie = getCookie(token);

    const csrfResponse = await fetch(
      new URL("/api/v1/admin/auth/csrf", base),
      {
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!csrfResponse.ok) {
      return failure(
        csrfResponse.status === 401 ? 401 : 502,
        "CSRF verification unavailable.",
      );
    }

    const csrf: unknown = await csrfResponse.json();

    if (
      !csrf ||
      typeof csrf !== "object" ||
      !("data" in csrf) ||
      !csrf.data ||
      typeof csrf.data !== "object" ||
      !("csrfToken" in csrf.data) ||
      typeof csrf.data.csrfToken !== "string"
    ) {
      return failure(502, "Invalid CSRF response.");
    }

    const upstream = await fetch(
      new URL("/api/v1/admin/products", base),
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "X-CSRF-Token": csrf.data.csrfToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: raw,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      },
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      return failure(502, "Unexpected API redirect.");
    }

    const responseText = await upstream.text();

    if (responseText.length > 2_000_000) {
      return failure(502, "API response too large.");
    }

    let result: unknown;

    try {
      result = JSON.parse(responseText);
    } catch {
      return failure(502, "Invalid API response.");
    }

    return NextResponse.json(result, {
      status: upstream.status,
      headers: NO_STORE,
    });
  } catch {
    return failure(
      503,
      "Products service temporarily unavailable.",
    );
  }
}