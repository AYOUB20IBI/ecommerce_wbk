
"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  UserRound,
} from "lucide-react";

export type ProductAuthor = {
  id: string;
  name: string;
};

export type ProductAuthorInfo = {
  createdBy: ProductAuthor | null;
  updatedBy: ProductAuthor | null;
};

type Props = {
  createdAt: string;
  updatedAt: string;
  authors?: ProductAuthorInfo;
  mode: "created" | "updated" | "both";
  canViewAdminDetails: boolean;
  compact?: boolean;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Casablanca",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : formatter.format(date);
}

function AuthorLink({
  author,
  canViewAdminDetails,
}: {
  author: ProductAuthor | null | undefined;
  canViewAdminDetails: boolean;
}) {
  if (!author) {
    return (
      <span className="text-[#9AA5B8]">
        —
      </span>
    );
  }

  if (!canViewAdminDetails) {
    return (
      <span className="text-[#697893]">
        {author.name}
      </span>
    );
  }

  return (
    <Link
      href={`/admin/users/${encodeURIComponent(author.id)}`}
      title={`View ${author.name}'s admin details`}
      className="font-semibold text-[#6D5DF6] underline-offset-2 transition-colors hover:text-[#4F40D8] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6D5DF6]"
    >
      {author.name}
    </Link>
  );
}

export function ProductAuditInfo({
  createdAt,
  updatedAt,
  authors,
  mode,
  canViewAdminDetails,
  compact = false,
}: Props) {
  const showCreated =
    mode === "created" || mode === "both";

  const showUpdated =
    mode === "updated" || mode === "both";

  return (
    <div className={compact ? "space-y-1" : "space-y-3"}>
      {showCreated && (
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-[#98A4B7]" />

          <div className="min-w-0">
            {!compact && (
              <p className="text-[10px] text-[#8B97AC]">
                Created
              </p>
            )}

            <p className="whitespace-nowrap text-[11px] font-medium text-[#344362]">
              {formatDate(createdAt)}
            </p>

            <div className="mt-1 flex items-center gap-1 text-[11px]">
              <UserRound className="size-3 shrink-0 text-[#98A4B7]" />

              <AuthorLink
                author={authors?.createdBy}
                canViewAdminDetails={canViewAdminDetails}
              />
            </div>
          </div>
        </div>
      )}

      {showUpdated && (
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 size-3.5 shrink-0 text-[#98A4B7]" />

          <div className="min-w-0">
            {!compact && (
              <p className="text-[10px] text-[#8B97AC]">
                Last Updated
              </p>
            )}

            <p className="whitespace-nowrap text-[11px] font-medium text-[#344362]">
              {formatDate(updatedAt)}
            </p>

            <div className="mt-1 flex items-center gap-1 text-[11px]">
              <UserRound className="size-3 shrink-0 text-[#98A4B7]" />

              <AuthorLink
                author={authors?.updatedBy}
                canViewAdminDetails={canViewAdminDetails}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
