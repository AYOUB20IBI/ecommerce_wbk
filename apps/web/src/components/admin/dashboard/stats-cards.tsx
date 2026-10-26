
import {
  ArrowUpRight,
  Package,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { dashboardStats } from "./dashboard-data";

const icons = [Wallet, ShoppingCart, Users, Package];

const themes = {
  green: {
    icon: "bg-[#E1F8EC] text-[#09B778]",
    line: "#11C68A",
  },
  purple: {
    icon: "bg-[#EEEAFE] text-[#745CFA]",
    line: "#8468FF",
  },
  orange: {
    icon: "bg-[#FFF0DF] text-[#FF8C19]",
    line: "#FF9B23",
  },
  blue: {
    icon: "bg-[#E7EFFF] text-[#497BFF]",
    line: "#5387FF",
  },
};

function MiniChart({
  points,
  color,
}: {
  points: readonly number[];
  color: string;
}) {
  const line = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 95;
      const y = 45 - value;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 95 48"
      className="h-12 w-[95px]"
      aria-hidden="true"
    >
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatsCards() {
  return (
    <section
      aria-label="Demo store statistics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {dashboardStats.map((stat, index) => {
        const Icon = icons[index];
        const theme = themes[stat.color];

        return (
          <article
            key={stat.title}
            className="admin-hover-card min-w-0 rounded-2xl border border-[#EDF0F6] bg-white p-4 shadow-[0_4px_22px_rgba(21,37,76,0.025)]"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#7382A3]">
                  {stat.title}
                </p>

                <p className="mt-1.5 text-[clamp(17px,1.55vw,23px)] font-bold tracking-tight text-[#122143]">
                  {stat.value}
                </p>

                <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#05B778]">
                  <ArrowUpRight className="size-3.5" />
                  {stat.growth}
                </div>
              </div>
            </div>

            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="text-[10px] text-[#8290B0]">
                vs last month
              </span>

              <MiniChart
                points={stat.points}
                color={theme.line}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}
