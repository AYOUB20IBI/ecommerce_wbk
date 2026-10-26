
"use client";

import { useMemo, useState } from "react";
import { categories } from "./dashboard-data";

type Period = "month" | "quarter" | "year";

const factors: Record<Period, number[]> = {
  month: [1, 1, 1, 1, 1, 1, 1],
  quarter: [1.13, 0.92, 1.08, 0.95, 1.05, 0.91, 1],
  year: [0.93, 1.15, 0.95, 1.11, 0.98, 1.03, 1],
};

const totalSales: Record<Period, string> = {
  month: "MAD 245,890",
  quarter: "MAD 728,540",
  year: "MAD 2.84M",
};

export function CategoryChart() {
  const [period, setPeriod] = useState<Period>("month");

  const chartData = useMemo(() => {
    const weighted = categories.map((item, index) => ({
      ...item,
      weight: item.value * factors[period][index],
    }));

    const total = weighted.reduce(
      (sum, item) => sum + item.weight,
      0
    );

    return weighted.map((item) => ({
      ...item,
      percentage: (item.weight / total) * 100,
    }));
  }, [period]);

  const gradient = chartData
    .reduce(
      (result, item) => {
        const start = result.end;
        const end = start + item.percentage;

        return {
          end,
          stops: [
            ...result.stops,
            `${item.color} ${start}% ${end}%`,
          ],
        };
      },
      { end: 0, stops: [] as string[] }
    )
    .stops.join(", ");

  return (
    <section className="min-w-0 rounded-2xl border border-[#EDF0F6] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#152345]">
          Sales by Category
        </h2>

        <label>
          <span className="sr-only">Category chart period</span>
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as Period)
            }
            className="h-9 cursor-pointer rounded-lg border border-[#E6EBF5] bg-white px-3 text-[11px] text-[#324567] outline-none focus-visible:ring-2 focus-visible:ring-[#6D5DF6]"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </label>
      </div>

      <div className="mt-7 flex flex-col items-center justify-center gap-6 2xl:flex-row">
        <div
          key={period}
          role="img"
          aria-label={`Sample category distribution for ${period}`}
          className="admin-donut-enter flex size-[195px] shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        >
          <div className="flex size-[126px] flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-[15px] font-bold text-[#142345]">
              {totalSales[period]}
            </span>

            <span className="mt-1 text-[11px] text-[#7F8DAD]">
              Total Sales
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 2xl:grid-cols-1">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 text-[11px]"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />

              <span className="min-w-0 flex-1 text-[#4A5A7A]">
                {item.name}
              </span>

              <span className="font-semibold text-[#26375B]">
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
