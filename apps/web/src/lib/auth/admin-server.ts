
import "server-only";

import { cookies } from "next/headers";
import { getAdminCookieConfig } from "./admin-cookie-config";

export type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
};

type AdminMeResponse = {
  success: boolean;
  data?: {
    admin?: {
      id?: unknown;
      email?: unknown;
      firstName?: unknown;
      lastName?: unknown;
      roles?: unknown;
    };
  };
};

export function getNestApiUrl(): string {
  const raw = process.env.NEST_API_URL;

  if (!raw) {
    throw new Error("NEST_API_URL is not configured.");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error(
      "NEST_API_URL must use HTTPS outside localhost.",
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid NEST_API_URL.");
  }

  return url.origin;
}

export function getAdminCookieName(): string {
  return getAdminCookieConfig().name;
}

export async function getAdminSessionToken():
  Promise<string | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    getAdminCookieName(),
  )?.value;

  return token && /^[a-f0-9]{64}$/.test(token)
    ? token
    : null;
}

export async function getCurrentAdmin():
  Promise<AdminUser | null> {
  const token = await getAdminSessionToken();

  if (!token) {
    return null;
  }

  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/auth/me`,
    {
      method: "GET",
      headers: {
        Cookie: `${getAdminCookieName()}=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Admin session verification failed: ${response.status}`,
    );
  }

  const body =
    (await response.json()) as AdminMeResponse;

  const admin = body.data?.admin;

  if (
    body.success !== true ||
    !admin ||
    typeof admin.id !== "string" ||
    typeof admin.email !== "string"
  ) {
    throw new Error("Invalid admin session response.");
  }

  if (
    admin.roles !== undefined &&
    (
      !Array.isArray(admin.roles) ||
      !admin.roles.every(
        (role: unknown) =>
          typeof role === "string",
      )
    )
  ) {
    throw new Error("Invalid admin roles response.");
  }

  return {
    id: admin.id,
    email: admin.email,
    firstName:
      typeof admin.firstName === "string"
        ? admin.firstName
        : null,
    lastName:
      typeof admin.lastName === "string"
        ? admin.lastName
        : null,
    roles: Array.isArray(admin.roles)
      ? admin.roles
      : [],
  };
}
