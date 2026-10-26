
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { ProductsManager } from "@/features/admin/products/components/products-manager";

export const metadata: Metadata = {
  title: "Products | Commerce Engine",
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

  const has = (permission: string) =>
    access.permissions.includes(permission);

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
        {has("products.read") ? (
          <ProductsManager
            canCreate={has("products.create")}
            canUpdate={has("products.update")}
            canDelete={has("products.delete")}
            canPurge={has("products.purge")}
          />
        ) : (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <ShieldAlert className="size-12 text-red-500" />

            <h1 className="mt-4 text-xl font-bold text-[#172444]">
              Access Denied
            </h1>

            <p className="mt-2 text-sm text-[#8290AC]">
              products.read permission required.
            </p>

            <Link
              href="/admin"
              className="mt-5 font-semibold text-[#6D5DF6]"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
