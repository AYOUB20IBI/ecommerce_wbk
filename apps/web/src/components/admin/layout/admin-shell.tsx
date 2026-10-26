
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AdminUser } from "@/lib/auth/admin-server";
import type { AdminAccess } from "@/features/admin/auth/types/admin-access";

import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

type AdminShellProps = {
  admin: AdminUser;
  access: AdminAccess;
  children: ReactNode;
};

export function AdminShell({
  admin,
  access,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const triggerElement = mobileTriggerRef.current;
    const drawer = mobileDrawerRef.current;

    document.body.style.overflow = "hidden";

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    function getFocusableElements(): HTMLElement[] {
      if (!drawer) return [];

      return Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.hasAttribute("inert"),
      );
    }

    getFocusableElements()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();

      if (focusable.length === 0) {
        event.preventDefault();
        drawer?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!drawer?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen min-w-0 bg-background">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AdminSidebar
          admin={admin}
          access={access}
          collapsed={collapsed}
          onToggleCollapse={() =>
            setCollapsed((previous) => !previous)
          }
        />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <AdminHeader
          admin={admin}
          onOpenMobile={() => setMobileOpen(true)}
          mobileTriggerRef={mobileTriggerRef}
        />

        {children}
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#14213E]/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />

          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            tabIndex={-1}
            className="admin-sidebar-enter relative h-full w-[min(280px,88vw)] shadow-2xl"
          >
            <AdminSidebar
              admin={admin}
              access={access}
              mobile
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
