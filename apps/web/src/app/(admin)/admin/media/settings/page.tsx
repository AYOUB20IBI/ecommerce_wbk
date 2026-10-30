
import type { Metadata } from "next";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getCurrentAdmin,
} from "@/lib/auth/admin-server";

import {
  getCurrentAdminAccess,
} from "@/lib/auth/admin-access-server";

import {
  AdminShell,
} from "@/components/admin/layout/admin-shell";

import {
  MediaSettingsManager,
} from "@/features/admin/media/components/media-settings-manager";

export const metadata: Metadata = {
  title: "Media Settings | Commerce Engine",
  robots: {
    index: false,
    follow: false,
  },
};

function isAdmin(roles: string[]): boolean {
  return roles.some((role) => {
    const name = role
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    return name === "admin" || name === "super admin";
  });
}

function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center bg-[#F8F9FC]">
      <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
    </div>
  );
}

async function SettingsContent() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const access = await getCurrentAdminAccess();

  if (!access || access.adminId !== admin.id) {
    redirect("/admin/login");
  }

  const allowed = isAdmin(access.roles);

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
        {allowed ? (
          <MediaSettingsManager />
        ) : (
          <div className="rounded-2xl border border-[#E6EAF3] bg-white p-10 text-center">
            <h1 className="text-xl font-bold text-[#172444]">
              Access Denied
            </h1>

            <p className="mt-2 text-sm text-[#8290AC]">
              Only administrators can access Media Settings.
            </p>

            <Link
              href="/admin"
              className="mt-5 inline-block text-sm font-semibold text-[#6D5DF6]"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

export default function MediaSettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsContent />
    </Suspense>
  );
}
