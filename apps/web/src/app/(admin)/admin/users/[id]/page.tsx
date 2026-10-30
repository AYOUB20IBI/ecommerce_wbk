
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  getCurrentAdmin,
  getAdminCookieName,
  getAdminSessionToken,
  getNestApiUrl,
} from "@/lib/auth/admin-server";

import {
  getCurrentAdminAccess,
} from "@/lib/auth/admin-access-server";

import {
  AdminShell,
} from "@/components/admin/layout/admin-shell";

export const metadata: Metadata = {
  title: "Admin Details | Commerce Engine",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ id: string }>;
};

type AdminDetails = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    name: string;
  }>;
};

type AdminResponse = {
  success: boolean;
  data?: AdminDetails;
  message?: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Casablanca",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : formatter.format(date);
}

function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-[#F8F9FC]"
    >
      <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
    </div>
  );
}

async function fetchAdminDetails(
  id: string,
): Promise<AdminDetails | null> {
  const token = await getAdminSessionToken();

  if (!token) {
    return null;
  }

  const response = await fetch(
    `${getNestApiUrl()}/api/v1/admin/users/${encodeURIComponent(id)}`,
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

  if (response.status === 404) {
    notFound();
  }

  if (response.status === 401) {
    redirect("/admin/login");
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load admin details (${response.status}).`,
    );
  }

  const body =
    (await response.json()) as AdminResponse;

  if (
    body.success !== true ||
    !body.data ||
    body.data.id !== id ||
    typeof body.data.email !== "string" ||
    !Array.isArray(body.data.roles)
  ) {
    throw new Error("Invalid admin details response.");
  }

  return body.data;
}

async function Content({
  params,
}: PageProps) {
  const { id } = await params;

  if (!UUID.test(id)) {
    notFound();
  }

  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect("/admin/login");
  }

  const access = await getCurrentAdminAccess();

  if (!access || access.adminId !== currentAdmin.id) {
    redirect("/admin/login");
  }

  if (!access.permissions.includes("roles.manage")) {
    return (
      <AdminShell admin={currentAdmin} access={access}>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-xl font-bold text-[#172444]">
            Access Denied
          </h1>

          <p className="mt-2 text-sm text-[#8290AC]">
            You do not have permission to view admin details.
          </p>

          <Link
            href="/admin/products"
            className="mt-5 inline-block text-sm font-semibold text-[#6554D8]"
          >
            Back to Products
          </Link>
        </main>
      </AdminShell>
    );
  }

  const user = await fetchAdminDetails(id);

  if (!user) {
    redirect("/admin/login");
  }

  const fullName =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || user.email;

  return (
    <AdminShell admin={currentAdmin} access={access}>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-7">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#6554D8]"
        >
          <ArrowLeft className="size-4" />
          Back to Products
        </Link>

        <header className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#EEEAFE] text-[#6554D8]">
            <UserRound className="size-8" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8A95AB]">
              Administration / Admin Details
            </p>

            <h1 className="mt-1 break-words text-2xl font-bold text-[#172444]">
              {fullName}
            </h1>

            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                user.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[#E9EDF6] bg-white p-6">
            <h2 className="text-sm font-bold text-[#172444]">
              Personal Information
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs text-[#8794AC]">
                  First Name
                </p>
                <p className="mt-1 text-sm font-medium text-[#293955]">
                  {user.firstName || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#8794AC]">
                  Last Name
                </p>
                <p className="mt-1 text-sm font-medium text-[#293955]">
                  {user.lastName || "—"}
                </p>
              </div>

              <div>
                <p className="flex items-center gap-2 text-xs text-[#8794AC]">
                  <Mail className="size-3.5" />
                  Email Address
                </p>
                <p className="mt-1 break-all text-sm font-medium text-[#293955]">
                  {user.email}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9EDF6] bg-white p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#172444]">
              <ShieldCheck className="size-4 text-[#6554D8]" />
              Assigned Roles
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              {user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <span
                    key={role.id}
                    className="rounded-lg bg-[#F0EDFF] px-3 py-2 text-xs font-semibold text-[#6554D8]"
                  >
                    {role.name}
                  </span>
                ))
              ) : (
                <p className="text-xs text-[#8794AC]">
                  No roles assigned.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9EDF6] bg-white p-6 md:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#172444]">
              <CalendarDays className="size-4 text-[#6554D8]" />
              Account Activity
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#8794AC]">
                  Account Created
                </p>
                <p className="mt-1 text-sm font-medium text-[#293955]">
                  {formatDate(user.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#8794AC]">
                  Last Account Update
                </p>
                <p className="mt-1 text-sm font-medium text-[#293955]">
                  {formatDate(user.updatedAt)}
                </p>
              </div>
            </div>
          </section>
        </div>

        <p className="text-xs text-[#8794AC]">
          This page is read-only. User management is available
          through the Admin Users section.
        </p>
      </main>
    </AdminShell>
  );
}

export default function AdminDetailsPage({
  params,
}: PageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <Content params={params} />
    </Suspense>
  );
}
