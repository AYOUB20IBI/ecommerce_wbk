
"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

const options = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

export function DashboardDateFilter() {
  const [period, setPeriod] = useState("30d");

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#E7EBF5] bg-white px-3 py-2.5">
      <CalendarDays
        className="size-4 shrink-0 text-[#546687]"
        aria-hidden="true"
      />

      <label className="sr-only" htmlFor="dashboard-date-filter">
        Dashboard period
      </label>

      <select
        id="dashboard-date-filter"
        value={period}
        onChange={(event) => setPeriod(event.target.value)}
        className="min-w-0 cursor-pointer appearance-none bg-transparent text-xs font-medium text-[#32476F] outline-none focus-visible:ring-2 focus-visible:ring-[#6D5DF6]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        className="size-3.5 text-[#8290AB]"
        aria-hidden="true"
      />

      <span className="sr-only" aria-live="polite">
        Selected: {period}. Summary cards remain sample data.
      </span>
    </div>
  );
}
