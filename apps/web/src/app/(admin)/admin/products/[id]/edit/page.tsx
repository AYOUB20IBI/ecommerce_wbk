
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { ProductEditor } from "@/features/admin/products/components/product-editor";

export const metadata: Metadata = {
  title: "Edit Product | Commerce Engine",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-[#F8F9FC]"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-[#E9E5FF] border-t-[#6D5DF6]" />
        <p className="text-xs text-[#8794AC]">
          Loading product editor...
        </p>
      </div>
    </div>
  );
}

async function AuthenticatedProductEditor({
  params,
}: PageProps) {
  // Next.js 16 runtime params must be read
  // inside the Suspense boundary.
  const { id } = await params;

  if (!UUID.test(id)) {
    notFound();
  }

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

  const canRead =
    access.permissions.includes("products.read");

  const canUpdate =
    access.permissions.includes("products.update");

  const canCreate =
    access.permissions.includes("products.create");

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] px-3 py-6 sm:px-5 lg:px-7">
        {canRead && canUpdate ? (
          <ProductEditor
            productId={id}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        ) : (
          <div className="flex min-h-[65vh] flex-col items-center justify-center rounded-2xl border border-[#E9EDF6] bg-white px-5 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldAlert className="size-8" />
            </div>

            <h1 className="mt-5 text-xl font-bold text-[#172444]">
              Access Denied
            </h1>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#8290AC]">
              Your account needs products.read and
              products.update permissions to edit this product.
            </p>

            <Link
              href="/admin/products"
              className="mt-6 rounded-xl bg-[#6D5DF6] px-5 py-3 text-xs font-semibold text-white"
            >
              Back to Products
            </Link>
          </div>
        )}
      </main>
    </AdminShell>
  );
}

export default function EditProductPage({
  params,
}: PageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <AuthenticatedProductEditor params={params} />
    </Suspense>
  );
}
