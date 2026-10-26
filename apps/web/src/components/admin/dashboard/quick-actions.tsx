
"use client";

import { useState } from "react";
import {
  Plus,
  ClipboardList,
  TicketPercent,
  Users,
  ImagePlus,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type Action = {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
};

const actions: Action[] = [
  {
    id: "product",
    title: "Add Product",
    description: "Create a new product",
    detail:
      "Product editor will be available when the Products frontend is integrated.",
    icon: Plus,
    color: "bg-[#F2EEFF]",
    iconColor: "bg-[#E5DFFF] text-[#725BF6]",
  },
  {
    id: "orders",
    title: "Manage Orders",
    description: "View and process orders",
    detail:
      "Order management will be enabled after the Orders API is implemented.",
    icon: ClipboardList,
    color: "bg-[#E9F9F1]",
    iconColor: "bg-[#D4F5E4] text-[#00B779]",
  },
  {
    id: "coupon",
    title: "Create Coupon",
    description: "Set up a new discount",
    detail:
      "Coupon creation will be available when the Promotions module is ready.",
    icon: TicketPercent,
    color: "bg-[#FFF4E8]",
    iconColor: "bg-[#FFE6CD] text-[#F89116]",
  },
  {
    id: "customer",
    title: "Add Customer",
    description: "Create a customer account",
    detail:
      "Customer management will use authenticated NestJS endpoints.",
    icon: Users,
    color: "bg-[#EBF2FF]",
    iconColor: "bg-[#DBE8FF] text-[#447AF5]",
  },
  {
    id: "media",
    title: "Upload Media",
    description: "Add images and files",
    detail:
      "Media uploads will be connected to the existing NestJS Media API.",
    icon: ImagePlus,
    color: "bg-[#FFF0F3]",
    iconColor: "bg-[#FFE0E8] text-[#F04467]",
  },
];

export function QuickActions() {
  const [selected, setSelected] = useState<string | null>(null);

  const current = actions.find((item) => item.id === selected);

  return (
    <section className="min-w-0 rounded-2xl border border-[#EDF0F6] bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-[#152345]">
        Quick Actions
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          const active = selected === action.id;

          return (
            <button
              key={action.id}
              type="button"
              aria-expanded={active}
              aria-controls="dashboard-quick-action-detail"
              onClick={() =>
                setSelected((previous) =>
                  previous === action.id ? null : action.id
                )
              }
              className={[
                "admin-hover-card group flex min-h-[82px]",
                "w-full items-center gap-3 rounded-xl border p-3",
                "text-left focus-visible:outline-2",
                "focus-visible:outline-[#6D5DF6]",
                action.color,
                active
                  ? "border-[#A99CFB] ring-2 ring-[#6D5DF6]/10"
                  : "border-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-10 shrink-0 items-center",
                  "justify-center rounded-xl",
                  "transition-transform duration-200",
                  "group-hover:scale-105",
                  action.iconColor,
                ].join(" ")}
              >
                <Icon className="size-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#24365D]">
                  {action.title}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[#7888A7]">
                  {action.description}
                </span>
              </span>

              <ChevronDown
                className={[
                  "size-3.5 shrink-0 text-[#8290AB]",
                  "transition-transform duration-200",
                  active ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>

      <div id="dashboard-quick-action-detail" aria-live="polite">
        {current && (
          <div className="admin-section-enter mt-3 rounded-xl border border-[#E8E4FF] bg-[#FAF9FF] p-4">
            <p className="text-xs font-semibold text-[#6253E8]">
              {current.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              {current.detail}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
