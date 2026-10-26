
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";

import { AdminShell } from "@/components/admin/layout/admin-shell";

import { ProductEditor } from "@/features/admin/products/components/product-editor";

export const metadata: Metadata = {
  title: "Create Product | Commerce Engine",
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

  const canCreate = access.permissions.includes(
    "products.create",
  );

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
        {canCreate ? (
          <ProductEditor
            canCreate={canCreate}
            canUpdate={access.permissions.includes(
              "products.update",
            )}
          />
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-[#172444]">
              Access Denied
            </h1>
            <p className="mt-2 text-sm text-[#8290AC]">
              products.create permission required.
            </p>
            <Link
              href="/admin/products"
              className="mt-5 inline-block text-sm font-semibold text-[#6D5DF6]"
            >
              Back to Products
            </Link>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
