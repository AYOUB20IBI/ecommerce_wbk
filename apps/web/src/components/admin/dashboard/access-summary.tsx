
"use client";

import { useState } from "react";
import {
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

import type {
  AdminAccess,
} from "@/features/admin/auth/types/admin-access";

type Props = {
  access: AdminAccess;
};

export function AccessSummary({ access }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[#E7E2FF] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F0EDFF] text-[#6D5DF6]">
            <ShieldCheck className="size-5" />
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#172444]">
              Your Access
            </h2>

            <p className="mt-1 text-xs text-[#7888A7]">
              {access.roles.join(", ") || "No role assigned"}
              {" · "}
              {access.permissions.length} permissions
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-permission-details"
          onClick={() => setOpen((previous) => !previous)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#6554F5] transition-colors hover:bg-[#F5F2FF]"
        >
          {open ? "Hide details" : "View permissions"}

          <ChevronDown
            className={[
              "size-4 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>

      {open && (
        <div
          id="admin-permission-details"
          className="mt-4 border-t border-[#EDF0F6] pt-4"
        >
          {access.permissions.length === 0 ? (
            <p className="text-xs text-[#8490A8]">
              No permissions assigned to this account.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {access.permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-lg bg-[#F3F0FF] px-2.5 py-1.5 text-[11px] font-medium text-[#6554D8]"
                >
                  {permission}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
