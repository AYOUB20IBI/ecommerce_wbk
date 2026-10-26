
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCookieName,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function getAppOrigin(): string {
  const raw = process.env.ADMIN_APP_ORIGIN;

  if (!raw) {
    throw new Error("ADMIN_APP_ORIGIN is missing");
  }

  const parsed = new URL(raw);

  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN");
  }

  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  ) {
    throw new Error("HTTPS is required");
  }

  return parsed.origin;
}

export async function POST(request: NextRequest) {
  let appOrigin: string;

  try {
    appOrigin = getAppOrigin();
  } catch {
    return jsonError(
      500,
      "Authentication service is not configured."
    );
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    origin !== appOrigin ||
    request.nextUrl.origin !== appOrigin ||
    fetchSite === "cross-site"
  ) {
    return jsonError(403, "Origin not allowed.");
  }

  const cookieName = getAdminCookieName();
  const token = request.cookies.get(cookieName)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return jsonError(401, "Authentication required.");
  }

  const cookieHeader = `${cookieName}=${token}`;

  try {
    const baseUrl = getNestApiUrl();

    // Step 1: obtain a CSRF token from NestJS.
    // Keep it on the server; never return it to the browser.
    const csrfResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/csrf`,
      {
        method: "GET",
        headers: {
          Cookie: cookieHeader,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!csrfResponse.ok) {
      return jsonError(
        csrfResponse.status === 401 ? 401 : 503,
        csrfResponse.status === 401
          ? "Your session has expired."
          : "Unable to verify logout security."
      );
    }

    const csrfBody: unknown = await csrfResponse.json();

    if (
      !csrfBody ||
      typeof csrfBody !== "object" ||
      !("data" in csrfBody) ||
      !csrfBody.data ||
      typeof csrfBody.data !== "object" ||
      !("csrfToken" in csrfBody.data) ||
      typeof csrfBody.data.csrfToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(csrfBody.data.csrfToken)
    ) {
      return jsonError(502, "Invalid CSRF response.");
    }

    const csrfToken = csrfBody.data.csrfToken;

    // Step 2: request a real database session revocation.
    const logoutResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/logout`,
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          Origin: appOrigin,
          "X-CSRF-Token": csrfToken,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!logoutResponse.ok) {
      return jsonError(
        logoutResponse.status === 401 ? 401 : 502,
        logoutResponse.status === 401
          ? "Session no longer valid."
          : "Logout failed. Please try again."
      );
    }

    const logoutBody: unknown = await logoutResponse.json();

    if (
      !logoutBody ||
      typeof logoutBody !== "object" ||
      !("success" in logoutBody) ||
      logoutBody.success !== true
    ) {
      return jsonError(
        502,
        "Logout was not confirmed by the server."
      );
    }

    // Step 3: clear the browser cookie only after
    // NestJS has confirmed the session revocation.
    const response = NextResponse.json(
      {
        success: true,
        message: "Signed out successfully.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Clear-Site-Data": '"cache"',
        },
      }
    );

    response.cookies.set({
      name: cookieName,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return jsonError(
      503,
      "Logout service temporarily unavailable."
    );
  }
}
