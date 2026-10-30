
import type { Metadata } from "next";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";
import { AdminShell } from "@/components/admin/layout/admin-shell";

import { MediaLibraryManager } from "@/features/admin/media/components/media-library-manager";

export const metadata: Metadata = {
  title: "Media Library | Commerce Engine",
  robots: {
    index: false,
    follow: false,
  },
};

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FC]">
      <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
    </div>
  );
}

async function Content() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const access = await getCurrentAdminAccess();

  if (!access || access.adminId !== admin.id) {
    redirect("/admin/login");
  }

  const canRead = access.permissions.includes("media.read");
  const canCreate = access.permissions.includes("media.create");
  const canUpdate = access.permissions.includes("media.update");
  const canDelete = access.permissions.includes("media.delete");

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
        {canRead ? (
          <MediaLibraryManager
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        ) : (
          <div className="rounded-2xl border border-[#E6EAF3] bg-white p-10 text-center">
            <h1 className="text-xl font-bold text-[#172444]">
              Access Denied
            </h1>

            <p className="mt-2 text-sm text-[#8290AC]">
              You need media.read permission to view the Media Library.
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

export default function MediaLibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
