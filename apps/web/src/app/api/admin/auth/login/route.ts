
// import { NextRequest, NextResponse } from "next/server";

// import { getNestApiUrl } from "@/lib/auth/admin-server";

// // export const runtime = "nodejs";
// // export const dynamic = "force-dynamic";

// function errorResponse(
//   status: number,
//   message: string
// ): NextResponse {
//   return NextResponse.json(
//     {
//       success: false,
//       message,
//     },
//     {
//       status,
//       headers: {
//         "Cache-Control": "no-store",
//       },
//     }
//   );
// }

// function expectedOrigin(): string {
//   const configured = process.env.ADMIN_APP_ORIGIN;

//   if (!configured) {
//     throw new Error("ADMIN_APP_ORIGIN is missing.");
//   }

//   const parsed = new URL(configured);

//   if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
//     throw new Error("Invalid ADMIN_APP_ORIGIN.");
//   }

//   return parsed.origin;
// }

// export async function POST(request: NextRequest) {
//   const origin = request.headers.get("origin");
//   const fetchSite = request.headers.get("sec-fetch-site");

//   let appOrigin: string;

//   try {
//     appOrigin = expectedOrigin();
//   } catch {
//     return errorResponse(
//       500,
//       "Admin authentication is not configured."
//     );
//   }

//   // Require a trusted browser origin.
//   if (
//     origin !== appOrigin ||
//     request.nextUrl.origin !== appOrigin ||
//     fetchSite === "cross-site"
//   ) {
//     return errorResponse(403, "Request origin not allowed.");
//   }

//   const contentType =
//     request.headers.get("content-type") ?? "";

//   if (!contentType.toLowerCase().startsWith("application/json")) {
//     return errorResponse(415, "JSON content type required.");
//   }

//   const contentLength = Number(
//     request.headers.get("content-length") ?? "0"
//   );

//   if (contentLength > 4096) {
//     return errorResponse(413, "Request body too large.");
//   }

//   let body: unknown;

//   try {
//     const raw = await request.text();

//     if (raw.length > 4096) {
//       return errorResponse(413, "Request body too large.");
//     }

//     body = JSON.parse(raw);
//   } catch {
//     return errorResponse(400, "Invalid JSON body.");
//   }

//   if (
//     typeof body !== "object" ||
//     body === null ||
//     Array.isArray(body)
//   ) {
//     return errorResponse(400, "Invalid login credentials.");
//   }

//   const input = body as Record<string, unknown>;

//   if (
//     typeof input.email !== "string" ||
//     typeof input.password !== "string"
//   ) {
//     return errorResponse(
//       400,
//       "Email and password are required."
//     );
//   }

//   if (
//     input.email.length > 254 ||
//     input.password.length > 1024
//   ) {
//     return errorResponse(400, "Invalid login credentials.");
//   }

//   try {
//     const upstream = await fetch(
//       `${getNestApiUrl()}/api/v1/admin/auth/login`,
//       {
//         method: "POST",
//         headers: {
//           Origin: appOrigin,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//         body: JSON.stringify({
//           email: input.email,
//           password: input.password,
//         }),
//         cache: "no-store",
//         redirect: "manual",
//         signal: AbortSignal.timeout(10000),
//       }
//     );

//     if (upstream.status >= 300 && upstream.status < 400) {
//       return errorResponse(502, "Unexpected authentication redirect.");
//     }

//     let data: unknown;

//     try {
//       data = await upstream.json();
//     } catch {
//       return errorResponse(
//         502,
//         "Invalid authentication server response."
//       );
//     }

//     if (!upstream.ok) {
//       const upstreamData =
//         data && typeof data === "object"
//           ? (data as Record<string, unknown>)
//           : {};

//       const message =
//         typeof upstreamData.message === "string"
//           ? upstreamData.message
//           : "Authentication failed.";

//       return errorResponse(
//         upstream.status >= 400 && upstream.status < 500
//           ? upstream.status
//           : 502,
//         upstream.status === 401
//           ? "Invalid email or password."
//           : message
//       );
//     }

//     const sessionCookieName =
//       process.env.NODE_ENV === "production"
//         ? "__Host-admin_session"
//         : "admin_session";

//     const cookiesFromBackend =
//       upstream.headers.getSetCookie();
    
//     console.log("[LOGIN COOKIE CHECK]", {
//       expected: sessionCookieName,
//       received: cookiesFromBackend.map(
//         (cookie) => cookie.split("=")[0]?.trim(),
//       ),
//     });

//     const sessionCookie = cookiesFromBackend.find((cookie) =>
//       cookie.startsWith(`${sessionCookieName}=`)
//     );

//     if (!sessionCookie) {
//       return errorResponse(
//         502,
//         "Authentication response is missing the session cookie."
//       );
//     }

//     const cookieValue = sessionCookie
//       .split(";")[0]
//       ?.slice(sessionCookieName.length + 1);

//     if (!cookieValue || !/^[a-f0-9]{64}$/.test(cookieValue)) {
//       return errorResponse(
//         502,
//         "Invalid session cookie."
//       );
//     }

//     const response = NextResponse.json(
//       {
//         success: true,
//         message: "Signed in successfully.",
//       },
//       {
//         headers: {
//           "Cache-Control": "no-store",
//         },
//       }
//     );

//     // NestJS remains responsible for generating and validating
//     // the token. We only transfer the session to the same-origin
//     // browser cookie with enforced secure attributes.
//     response.cookies.set({
//       name: sessionCookieName,
//       value: cookieValue,
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       path: "/",
//       maxAge: 12 * 60 * 60,
//     });

//     return response;
//   } catch {
//     return errorResponse(
//       503,
//       "Authentication service is temporarily unavailable."
//     );
//   }
// }




import { NextRequest, NextResponse } from "next/server";

import { getNestApiUrl } from "@/lib/auth/admin-server";
import { getAdminCookieConfig } from "@/lib/auth/admin-cookie-config";

function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function expectedOrigin(): string {
  const configured = process.env.ADMIN_APP_ORIGIN;

  if (!configured) {
    throw new Error("ADMIN_APP_ORIGIN is missing.");
  }

  const parsed = new URL(configured);

  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN.");
  }

  return parsed.origin;
}

export async function POST(request: NextRequest) {
  let appOrigin: string;
  let cookieConfig: ReturnType<typeof getAdminCookieConfig>;

  try {
    appOrigin = expectedOrigin();
    cookieConfig = getAdminCookieConfig();
  } catch {
    return errorResponse(
      500,
      "Admin authentication is not configured.",
    );
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    origin !== appOrigin ||
    request.nextUrl.origin !== appOrigin ||
    (fetchSite !== null &&
      fetchSite !== "same-origin" &&
      fetchSite !== "none")
  ) {
    return errorResponse(403, "Request origin not allowed.");
  }

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    return errorResponse(415, "JSON content type required.");
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    !Number.isFinite(declaredLength) ||
    declaredLength > 4096
  ) {
    return errorResponse(413, "Request body too large.");
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).length > 4096) {
      return errorResponse(413, "Request body too large.");
    }

    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return errorResponse(400, "Invalid login credentials.");
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.email !== "string" ||
    typeof input.password !== "string" ||
    input.email.length > 254 ||
    input.password.length > 1024
  ) {
    return errorResponse(400, "Invalid login credentials.");
  }

  try {
    const upstream = await fetch(
      `${getNestApiUrl()}/api/v1/admin/auth/login`,
      {
        method: "POST",
        headers: {
          Origin: appOrigin,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
        }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      },
    );

    if (
      upstream.status >= 300 &&
      upstream.status < 400
    ) {
      return errorResponse(
        502,
        "Unexpected authentication redirect.",
      );
    }

    let data: unknown;

    try {
      data = await upstream.json();
    } catch {
      return errorResponse(
        502,
        "Invalid authentication server response.",
      );
    }

    if (!upstream.ok) {
      const upstreamData =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};

      const message =
        typeof upstreamData.message === "string"
          ? upstreamData.message
          : "Authentication failed.";

      return errorResponse(
        upstream.status >= 400 && upstream.status < 500
          ? upstream.status
          : 502,
        upstream.status === 401
          ? "Invalid email or password."
          : message,
      );
    }

    const cookiesFromBackend =
      upstream.headers.getSetCookie();

    const sessionCookie = cookiesFromBackend.find(
      (cookie) =>
        cookie.startsWith(`${cookieConfig.name}=`),
    );

    if (!sessionCookie) {
      console.error(
        "[Admin Login] Session cookie mismatch",
        {
          expected: cookieConfig.name,
          receivedNames: cookiesFromBackend.map(
            (cookie) => cookie.split("=")[0]?.trim(),
          ),
        },
      );

      return errorResponse(
        502,
        "Authentication response is missing the expected session cookie.",
      );
    }

    const cookieValue = sessionCookie
      .split(";")[0]
      ?.slice(cookieConfig.name.length + 1);

    if (
      !cookieValue ||
      !/^[a-f0-9]{64}$/.test(cookieValue)
    ) {
      return errorResponse(502, "Invalid session cookie.");
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Signed in successfully.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

    response.cookies.set({
      name: cookieConfig.name,
      value: cookieValue,
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return response;
  } catch {
    return errorResponse(
      503,
      "Authentication service is temporarily unavailable.",
    );
  }
}
