
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

type Props = {
  compact?: boolean;
  onSuccess?: () => void;
};

export function LogoutButton({
  compact = false,
  onSuccess,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/auth/logout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: "{}",
        }
      );

      const result: unknown = await response.json();

      const success =
        typeof result === "object" &&
        result !== null &&
        "success" in result &&
        result.success === true;

      if (!response.ok || !success) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : "Unable to sign out. Please try again.";

        setError(message);
        return;
      }

      onSuccess?.();

      // A full navigation clears the client-side router state
      // and reloads the server-authenticated login page.
      window.location.replace("/admin/login");
    } catch {
      setError(
        "Connection problem. Logout was not confirmed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={loading}
        onClick={handleLogout}
        title={compact ? "Sign out" : undefined}
        aria-label={compact ? "Sign out" : undefined}
        className={[
          "flex min-h-10 w-full items-center gap-2.5",
          "rounded-xl px-3 text-left text-xs font-semibold",
          "text-[#D9485F]",
          "transition-colors duration-200",
          "hover:bg-[#FFF0F3]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-2",
          "focus-visible:outline-[#E55A70]",
          compact ? "justify-center" : "",
        ].join(" ")}
      >
        {loading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" />
        ) : (
          <LogOut className="size-4 shrink-0" />
        )}

        {!compact && (
          <span>
            {loading ? "Signing out..." : "Sign out"}
          </span>
        )}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] leading-4 text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
