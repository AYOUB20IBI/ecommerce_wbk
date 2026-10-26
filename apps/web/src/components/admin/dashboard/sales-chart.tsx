
"use client";

import { useMemo, useState } from "react";

import {
  previousSalesData,
  salesData,
  type DashboardMetric,
  type DashboardPeriod,
} from "./dashboard-data";

const metrics: DashboardMetric[] = [
  "Revenue",
  "Orders",
  "Customers",
];

const multipliers: Record<DashboardMetric, number> = {
  Revenue: 1,
  Orders: 0.72,
  Customers: 0.49,
};

function getPath(
  values: number[],
  width: number,
  height: number,
  maximum: number
) {
  return values
    .map((value, index) => {
      const x =
        values.length > 1
          ? (index / (values.length - 1)) * width
          : 0;

      const y = height - (value / maximum) * height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function SalesChart() {
  const [metric, setMetric] = useState<DashboardMetric>("Revenue");
  const [period, setPeriod] = useState<DashboardPeriod>(30);

  const chart = useMemo(() => {
    const current = salesData
      .slice(-period)
      .map((value) => value * multipliers[metric]);

    const previous = previousSalesData
      .slice(-period)
      .map((value) => value * multipliers[metric]);

    const width = 700;
    const height = 210;
    const maximum = Math.max(...current, ...previous, 1) * 1.15;

    return {
      width,
      height,
      currentPath: getPath(current, width, height, maximum),
      previousPath: getPath(previous, width, height, maximum),
    };
  }, [metric, period]);

  return (
    <section className="min-w-0 rounded-2xl border border-[#EDF0F6] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#152345]">
            Sales & Orders
          </h2>
          <p className="mt-1 text-[11px] text-[#7F8DAD]">
            Revenue and orders over time — demo
          </p>
        </div>

        <label>
          <span className="sr-only">Chart time period</span>
          <select
            value={period}
            onChange={(event) =>
              setPeriod(Number(event.target.value) as DashboardPeriod)
            }
            className="h-9 cursor-pointer rounded-lg border border-[#E6EBF5] bg-white px-3 text-xs text-[#324567] outline-none focus-visible:ring-2 focus-visible:ring-[#6D5DF6]"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Chart metric"
          className="flex flex-wrap gap-2"
        >
          {metrics.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className={[
                "rounded-lg px-3 py-2 text-[11px] font-medium",
                "transition-all duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                "focus-visible:outline-[#6D5DF6]",
                item === metric
                  ? "bg-[#725BF6] text-white shadow-sm shadow-violet-200"
                  : "bg-[#F5F7FC] text-[#657595] hover:bg-[#EFEDFF]",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex gap-3 text-[10px] text-[#7786A5]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#745BF5]" />
            Current
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#C7BEFB]" />
            Previous
          </span>
        </div>
      </div>

      <div className="mt-6 flex h-[260px] gap-3">
        <div className="flex w-12 shrink-0 flex-col justify-between pb-6 text-right text-[10px] text-[#8B98B3]">
          {["100%", "75%", "50%", "25%", "0%"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="border-t border-[#EDF0F8]"
              />
            ))}
          </div>

          <svg
            key={`${metric}-${period}`}
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${metric} preview chart covering ${period} days`}
            className="admin-chart-enter absolute inset-x-0 top-0 h-[calc(100%-24px)] w-full"
          >
            <defs>
              <linearGradient
                id="dashboard-sales-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#8067F7"
                  stopOpacity="0.22"
                />
                <stop
                  offset="100%"
                  stopColor="#8067F7"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d={`${chart.currentPath} L ${chart.width} ${chart.height} L 0 ${chart.height} Z`}
              fill="url(#dashboard-sales-gradient)"
            />

            <path
              d={chart.previousPath}
              fill="none"
              stroke="#C8BEFB"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />

            <path
              d={chart.currentPath}
              fill="none"
              stroke="#745BF5"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-[#8B98B3]">
            <span>{period} days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-[#9AA6BB]">
        Normalized sample data for visual testing.
      </p>
    </section>
  );
}
