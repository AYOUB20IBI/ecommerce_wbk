
"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  X,
} from "lucide-react";

import type { AdminUser } from "@/lib/auth/admin-server";
import { LogoutButton } from "@/features/admin/auth/components/logout-button";
import { AdminProfile } from "./admin-profile";

type MenuName = "notifications" | "profile" | null;

type Props = {
  admin: AdminUser;
  onOpenMobile: () => void;
  mobileTriggerRef: RefObject<HTMLButtonElement | null>;
};

export function AdminHeader({
  admin,
  onOpenMobile,
  mobileTriggerRef,
}: Props) {
  const [activeMenu, setActiveMenu] = useState<MenuName>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
        setSearchOpen(false);
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setActiveMenu(null);
        setSearchOpen(true);
        searchRef.current?.focus();
      }
    }

    function onOutside(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        headerRef.current &&
        !headerRef.current.contains(event.target)
      ) {
        setActiveMenu(null);
        setSearchOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyboard);
    document.addEventListener("mousedown", onOutside);

    return () => {
      document.removeEventListener("keydown", onKeyboard);
      document.removeEventListener("mousedown", onOutside);
    };
  }, []);

  function toggleMenu(name: Exclude<MenuName, null>) {
    setActiveMenu((previous) =>
      previous === name ? null : name
    );
    setSearchOpen(false);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-[#E9EDF6] bg-white px-3 sm:px-5 lg:px-7"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          ref={mobileTriggerRef}
          type="button"
          aria-label="Open sidebar"
          onClick={onOpenMobile}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#EBEEF6] text-[#465779] transition-colors hover:bg-[#F5F3FF] lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="relative w-full max-w-[430px] min-w-0">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#EDF0F6] bg-[#F8F9FD] px-3 transition-colors focus-within:border-[#9B8EFF] focus-within:ring-2 focus-within:ring-[#6D5DF6]/10">
            <Search
              className="size-4 shrink-0 text-[#8492B0]"
              aria-hidden="true"
            />

            <input
              ref={searchRef}
              type="search"
              value={query}
              onFocus={() => {
                setSearchOpen(true);
                setActiveMenu(null);
              }}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, orders..."
              aria-label="Dashboard search preview"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#263658] outline-none placeholder:text-[#91A0BB]"
            />

            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="rounded-md p-1"
              >
                <X className="size-3.5 text-[#8A96AF]" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 rounded border border-[#E5E9F3] bg-white px-1.5 py-0.5 text-[10px] text-[#7F8DAD] sm:inline">
                Ctrl K
              </kbd>
            )}
          </div>

          {searchOpen && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl border border-[#E8EBF4] bg-white p-3 shadow-[0_15px_45px_rgba(20,35,70,0.12)]">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#97A2B8]">
                Quick Search
              </p>

              <button
                type="button"
                onClick={() => {
                  setQuery("Dashboard");
                  setSearchOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#263658] hover:bg-[#F3F0FF]"
              >
                <Search className="size-3.5 text-[#7665F6]" />
                Dashboard Overview
              </button>

              {query.trim() && (
                <p className="mt-2 border-t border-[#EDF0F6] pt-3 text-[11px] leading-5 text-[#8290AC]">
                  Search for &quot;{query}&quot; will use the
                  NestJS API after integration.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={activeMenu === "notifications"}
            onClick={() => toggleMenu("notifications")}
            className="relative flex size-10 items-center justify-center rounded-full border border-[#EBEEF6] text-[#465779] transition-colors hover:bg-[#F5F3FF]"
          >
            <Bell className="size-[18px]" />
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#FA4865] text-[9px] font-semibold text-white">
              3
            </span>
          </button>

          {activeMenu === "notifications" && (
            <div className="absolute right-0 top-full z-50 mt-3 w-[min(310px,calc(100vw-20px))] rounded-2xl border border-[#E8EBF4] bg-white p-4 shadow-[0_18px_55px_rgba(20,35,70,0.14)]">
              <h2 className="text-sm font-bold text-[#172747]">
                Notifications
              </h2>

              <p className="mt-1 text-[11px] text-[#8C9AB5]">
                Demo notifications
              </p>

              <div className="mt-3 space-y-2">
                {[
                  "New order received",
                  "Product stock is running low",
                  "Sales report is ready",
                ].map((message) => (
                  <div
                    key={message}
                    className="flex gap-2 rounded-xl bg-[#F8F9FD] p-3"
                  >
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-[#7865F7]" />
                    <p className="text-xs text-[#465779]">
                      {message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Profile menu"
            aria-expanded={activeMenu === "profile"}
            onClick={() => toggleMenu("profile")}
            className="flex min-w-0 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-[#F6F5FF]"
          >
            <span className="sm:hidden">
              <AdminProfile admin={admin} compact />
            </span>

            <span className="hidden max-w-[200px] sm:block">
              <AdminProfile admin={admin} />
            </span>

            <ChevronDown
              className={[
                "hidden size-4 text-[#64748B] transition-transform sm:block",
                activeMenu === "profile" ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {activeMenu === "profile" && (
            <div className="absolute right-0 top-full z-50 mt-3 w-[min(270px,calc(100vw-20px))] rounded-2xl border border-[#E8EBF4] bg-white p-4 shadow-[0_18px_55px_rgba(20,35,70,0.14)]">
              <AdminProfile admin={admin} />

              <p className="mt-3 break-all border-t border-[#EDF0F6] pt-3 text-xs text-[#8190AC]">
                {admin.email}
              </p>

              <div className="mt-3 border-t border-[#EDF0F6] pt-2">
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
