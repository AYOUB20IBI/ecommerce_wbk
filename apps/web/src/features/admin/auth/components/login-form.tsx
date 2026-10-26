
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";

type FormErrors = {
  email?: string;
  password?: string;
};

type LoginApiResponse = {
  success: boolean;
  message?: string;
};

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): FormErrors {
    const next: FormErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      next.email = "Email address is required.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      next.email = "Enter a valid email address.";
    }

    if (!password) {
      next.password = "Password is required.";
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setFormError("");

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result =
        (await response.json()) as LoginApiResponse;

      if (!response.ok || !result.success) {
        if (response.status === 429) {
          setFormError(
            "Too many login attempts. Please try again later."
          );
        } else {
          setFormError(
            result.message ?? "Unable to sign in."
          );
        }
        return;
      }

      // Never store session tokens in browser storage.
      setPassword("");

      router.replace("/admin");
      router.refresh();
    } catch {
      setFormError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-9 space-y-5"
    >
      <div className="space-y-2">
        <label
          htmlFor="admin-email"
          className="block text-sm font-medium text-[#26324A]"
        >
          Email address
        </label>

        <div
          className={[
            "flex h-12 items-center gap-3 rounded-xl border",
            "bg-white px-3.5 transition-all duration-200",
            "focus-within:border-[#8676FA]",
            "focus-within:ring-4 focus-within:ring-[#6D5DF6]/10",
            errors.email
              ? "border-red-400"
              : "border-[#DCE2EE]",
          ].join(" ")}
        >
          <Mail
            className="size-[18px] shrink-0 text-[#8190AD]"
            aria-hidden="true"
          />

          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            disabled={loading}
            placeholder="admin@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "admin-email-error" : undefined
            }
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((previous) => ({
                ...previous,
                email: undefined,
              }));
              setFormError("");
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1D2941] outline-none placeholder:text-[#A2AEC3] disabled:opacity-60"
          />
        </div>

        {errors.email && (
          <p
            id="admin-email-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="admin-password"
          className="block text-sm font-medium text-[#26324A]"
        >
          Password
        </label>

        <div
          className={[
            "flex h-12 items-center gap-3 rounded-xl border",
            "bg-white px-3.5 transition-all duration-200",
            "focus-within:border-[#8676FA]",
            "focus-within:ring-4 focus-within:ring-[#6D5DF6]/10",
            errors.password
              ? "border-red-400"
              : "border-[#DCE2EE]",
          ].join(" ")}
        >
          <LockKeyhole
            className="size-[18px] shrink-0 text-[#8190AD]"
            aria-hidden="true"
          />

          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            disabled={loading}
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? "admin-password-error"
                : undefined
            }
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((previous) => ({
                ...previous,
                password: undefined,
              }));
              setFormError("");
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1D2941] outline-none placeholder:text-[#A2AEC3] disabled:opacity-60"
          />

          <button
            type="button"
            disabled={loading}
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#8391AA] transition-colors hover:bg-[#F2F0FF] hover:text-[#6D5DF6]"
          >
            {showPassword ? (
              <EyeOff className="size-[18px]" />
            ) : (
              <Eye className="size-[18px]" />
            )}
          </button>
        </div>

        {errors.password && (
          <p
            id="admin-password-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.password}
          </p>
        )}
      </div>

      <p className="text-[11px] leading-5 text-[#8190AC]">
        For your security, admin sessions expire after 12 hours.
      </p>

      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"
        >
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={[
          "group flex h-12 w-full items-center",
          "justify-center gap-2 rounded-xl",
          "bg-gradient-to-r from-[#8170FF] to-[#6048EE]",
          "text-sm font-semibold text-white",
          "shadow-[0_9px_25px_rgba(109,93,246,0.18)]",
          "transition-all duration-200",
          "hover:-translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-65",
          "disabled:hover:translate-y-0",
        ].join(" ")}
      >
        {loading ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}
