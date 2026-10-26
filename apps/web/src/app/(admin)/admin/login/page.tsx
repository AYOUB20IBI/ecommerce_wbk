
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ArrowLeft,
  Check,
  ShoppingBag,
} from "lucide-react";

import { LoginForm } from "@/features/admin/auth/components/login-form";
import { getCurrentAdmin } from "@/lib/auth/admin-server";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Commerce Engine Admin.",
  robots: {
    index: false,
    follow: false,
  },
};

function LoginLoading() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-[#FCFCFF]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-4 border-[#E7E2FF] border-t-[#6D5DF6]" />

        <p className="text-sm text-[#7584A2]">
          Checking authentication...
        </p>
      </div>
    </div>
  );
}

async function LoginContent() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="relative isolate flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-[#FCFCFF] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[260px] bottom-[-330px] -z-10 size-[620px] rounded-full bg-[#E9E5FF] opacity-70"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[280px] -top-[340px] -z-10 size-[650px] rounded-full bg-[#F0EDFF] opacity-75"
      />

      <div className="relative w-full max-w-[535px]">
        <div className="rounded-[28px] border border-white bg-white px-6 py-9 shadow-[0_24px_90px_rgba(75,65,155,0.07)] sm:px-11 sm:py-11">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-[#F1EEFF] text-[#6D5DF6]">
              <ShoppingBag
                className="size-8"
                strokeWidth={2}
                aria-hidden="true"
              />

              <span className="absolute bottom-3 flex size-4 items-center justify-center rounded-full bg-[#6D5DF6] text-white">
                <Check
                  className="size-2.5"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              </span>
            </div>

            <p className="mt-3 text-lg font-bold tracking-tight text-[#15213C]">
              Commerce Engine
            </p>

            <p className="mt-1 text-sm text-[#8090AD]">
              Admin Panel
            </p>
          </div>

          <div className="mt-10 text-center">
            <h1 className="text-[30px] font-bold tracking-tight text-[#15213C] sm:text-[34px]">
              Welcome back
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#8190AC]">
              Sign in to your admin account to continue.
            </p>
          </div>

          <LoginForm />
        </div>

        <div className="mt-7 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#7565F2] transition-colors hover:bg-[#F1EEFF]"
          >
            <ArrowLeft className="size-4" />
            Back to store
          </Link>
        </div>

        <p className="mt-5 text-center text-[11px] text-[#A0AAC0]">
          Commerce Engine — Secure Admin Access
        </p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
