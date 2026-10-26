
import "server-only";

import {
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "./admin-server";

import type {
  AdminAccess,
} from "@/features/admin/auth/types/admin-access";

type AccessApiResponse = {
  success?: unknown;
  data?: {
    adminId?: unknown;
    roles?: unknown;
    permissions?: unknown;
  };
};

export async function getCurrentAdminAccess():
  Promise<AdminAccess | null> {
  const token = await getAdminSessionToken();

  if (!token) {
    return null;
  }

  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/access/me`,
    {
      method: "GET",
      headers: {
        Cookie: `${getAdminCookieName()}=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
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
      `Admin access verification failed: ${response.status}`,
    );
  }

  const body =
    (await response.json()) as AccessApiResponse;

  const data = body.data;

  if (
    body.success !== true ||
    !data ||
    typeof data.adminId !== "string" ||
    !Array.isArray(data.roles) ||
    !data.roles.every(
      (role: unknown) => typeof role === "string",
    ) ||
    !Array.isArray(data.permissions) ||
    !data.permissions.every(
      (permission: unknown) =>
        typeof permission === "string",
    )
  ) {
    throw new Error(
      "Invalid admin access response.",
    );
  }

  return {
    adminId: data.adminId,
    roles: [...new Set(data.roles as string[])],
    permissions: [
      ...new Set(data.permissions as string[]),
    ],
  };
}
