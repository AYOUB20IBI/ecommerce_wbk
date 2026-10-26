
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { ProfileManager } from "@/features/admin/profile/components/profile-manager";

export const metadata: Metadata = {
  title: "My Profile | Commerce Engine",
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
      <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
    </div>
  );
}

async function ProtectedProfile() {
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

  return (
    <AdminShell admin={admin} access={access}>
      <main className="w-full px-3 py-6 sm:px-5 lg:px-7">
        <ProfileManager />
      </main>
    </AdminShell>
  );
}

export default function AdminProfilePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProtectedProfile />
    </Suspense>
  );
}
