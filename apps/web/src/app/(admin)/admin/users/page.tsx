
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";

import { AdminShell } from "@/components/admin/layout/admin-shell";
import { AdminUsersManager } from "@/features/admin/users/components/admin-users-manager";

export const metadata: Metadata = {
  title: "Admin Users | Commerce Engine",
  robots: {
    index: false,
    follow: false,
  },
};

function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-[#F8F9FC]"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
        <p className="text-xs text-[#8794AC]">
          Verifying admin access...
        </p>
      </div>
    </div>
  );
}

async function AdminUsersContent() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const access = await getCurrentAdminAccess();

  if (!access) {
    redirect("/admin/login");
  }

  if (access.adminId !== admin.id) {
    throw new Error("Admin identity mismatch.");
  }

  const allowed =
    access.permissions.includes("roles.manage");

  return (
    <AdminShell admin={admin} access={access}>
      {allowed ? (
        <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
          <AdminUsersManager currentAdminId={admin.id} />
        </main>
      ) : (
        <main className="flex min-h-[75vh] flex-col items-center justify-center px-5 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="size-8" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#172444]">
            Access denied
          </h1>

          <p className="mt-2 max-w-md text-sm leading-6 text-[#8290AC]">
            Your account does not have the
            roles.manage permission required to manage
            admin accounts.
          </p>

          <Link
            href="/admin"
            className="mt-6 rounded-xl bg-[#6D5DF6] px-5 py-3 text-xs font-semibold text-white"
          >
            Back to Dashboard
          </Link>
        </main>
      )}
    </AdminShell>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminUsersContent />
    </Suspense>
  );
}
