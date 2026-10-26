
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin-server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-access-server";

import { AdminShell } from "@/components/admin/layout/admin-shell";
import { getAdminDisplayName } from "@/components/admin/layout/admin-profile";

import { DashboardDateFilter } from "@/components/admin/dashboard/dashboard-date-filter";
import { StatsCards } from "@/components/admin/dashboard/stats-cards";
import { SalesChart } from "@/components/admin/dashboard/sales-chart";
import { CategoryChart } from "@/components/admin/dashboard/category-chart";
import { RecentOrders } from "@/components/admin/dashboard/recent-orders";
import { QuickActions } from "@/components/admin/dashboard/quick-actions";
import { AccessSummary } from "@/components/admin/dashboard/access-summary";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Commerce Engine Admin Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FC] px-4">
      <div
        role="status"
        className="flex flex-col items-center gap-4"
      >
        <div className="size-11 animate-spin rounded-full border-4 border-[#E7E2FF] border-t-[#6D5DF6]" />

        <p className="text-sm font-medium text-[#64748B]">
          Verifying your access...
        </p>
      </div>
    </main>
  );
}

async function AuthenticatedDashboard() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const access = await getCurrentAdminAccess();

  if (!access) {
    redirect("/admin/login");
  }

  if (access.adminId !== admin.id) {
    throw new Error(
      "Admin session and access identity mismatch.",
    );
  }

  const displayName = getAdminDisplayName(admin);

  return (
    <AdminShell admin={admin} access={access}>
      <main className="mx-auto w-full max-w-[1700px] min-w-0 space-y-5 px-3 py-5 sm:px-5 lg:px-7">
        {/* Page heading */}
        <header className="admin-section-enter flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#7384AA]">
              Overview
            </p>

            <h1 className="mt-1 text-[clamp(22px,2.3vw,30px)] font-bold tracking-tight text-[#142344]">
              Welcome back, {displayName} 👋
            </h1>

            <p className="mt-1 text-xs leading-5 text-[#7889AC]">
              Here&apos;s what&apos;s happening with your
              store today.
            </p>
          </div>

          <DashboardDateFilter />
        </header>

        {/* Current admin permissions */}
        <AccessSummary access={access} />

        {/* KPIs */}
        <div className="admin-section-enter [animation-delay:60ms]">
          <StatsCards />
        </div>

        {/* Charts */}
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="admin-section-enter min-w-0 [animation-delay:100ms]">
            <SalesChart />
          </div>

          <div className="admin-section-enter min-w-0 [animation-delay:140ms]">
            <CategoryChart />
          </div>
        </div>

        {/* Orders */}
        <div className="admin-section-enter min-w-0 [animation-delay:180ms]">
          <RecentOrders />
        </div>

        {/* Actions remain UI previews until API integration */}
        <div className="admin-section-enter min-w-0 [animation-delay:220ms]">
          <QuickActions />
        </div>

        <footer className="pb-4 text-center text-[10px] text-[#9BA7BE]">
          Commerce Engine — Dashboard UI Preview.
          Sample statistics only.
        </footer>
      </main>
    </AdminShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
