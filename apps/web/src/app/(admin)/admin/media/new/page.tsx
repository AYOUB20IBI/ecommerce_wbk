
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { MediaUploader } from "@/features/admin/media/components/media-uploader";

export const metadata: Metadata = {
  title: "Add New Media | Commerce Engine",
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

  const canCreate = access.permissions.includes("media.create");
  const canRead = access.permissions.includes("media.read");

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1300px] space-y-6 px-3 py-6 sm:px-5 lg:px-7">
        {canCreate ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-[#172444]">
                  Add New Media
                </h1>
                <p className="mt-1 text-sm text-[#8290AC]">
                  Upload image files or add external image URLs.
                </p>
              </div>

              {canRead && (
                <Link
                  href="/admin/media"
                  className="rounded-xl border border-[#E5E8F2] bg-white px-4 py-2.5 text-xs font-bold text-[#6654DC]"
                >
                  View Media Library
                </Link>
              )}
            </div>

            <MediaUploader canRead={canRead} />
          </>
        ) : (
          <div className="rounded-2xl border border-[#E6EAF3] bg-white p-10 text-center">
            <h1 className="text-xl font-bold text-[#172444]">
              Access Denied
            </h1>
            <p className="mt-2 text-sm text-[#8290AC]">
              You need media.create permission to upload media.
            </p>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

export default function AddNewMediaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
