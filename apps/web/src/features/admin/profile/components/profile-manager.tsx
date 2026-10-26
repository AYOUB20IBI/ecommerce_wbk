
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Profile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

async function profileApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/profile${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  const result =
    (await response.json()) as ApiResponse<T>;

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || `Request failed (${response.status}).`,
    );
  }

  if (result.data === undefined) {
    throw new Error("Invalid response.");
  }

  return result.data;
}

function secureInt(max: number) {
  const bytes = new Uint8Array(1);
  const limit = 256 - (256 % max);

  while (true) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return bytes[0] % max;
  }
}

function generatePassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*-_+=?",
  ];

  const chars = groups.join("");
  const password = groups.map(
    (group) => group[secureInt(group.length)],
  );

  while (password.length < 24) {
    password.push(chars[secureInt(chars.length)]);
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  autocomplete: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  minLength = 1,
  maxLength,
  autocomplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-xs font-semibold text-[#465575]">
      {label}
      <div className="relative mt-2">
        <input
          id={id}
          required
          type={visible ? "text" : "password"}
          value={value}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autocomplete}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-[#E5E9F2] bg-white pl-3 pr-12 text-sm text-[#172444] outline-none focus:border-[#6D5DF6]"
        />

        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#8490A9] hover:bg-[#F1EEFF]"
        >
          {visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      </div>
    </label>
  );
}

export function ProfileManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    profileApi<Profile>("")
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setEmail(data.email);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setProfileError(
          error instanceof Error
            ? error.message
            : "Unable to load profile.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function saveInformation(event: FormEvent) {
    event.preventDefault();
    if (savingProfile) return;

    setSavingProfile(true);
    setProfileError("");
    setProfileNotice("");

    try {
      const data = await profileApi<Profile>("", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      setProfile((previous) => ({
        ...data,
        isActive: previous?.isActive ?? true,
        createdAt: previous?.createdAt ?? "",
      }));

      setFirstName(data.firstName ?? "");
      setLastName(data.lastName ?? "");
      setEmail(data.email);

      setProfileNotice(
        "Profile information updated successfully.",
      );
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Unable to update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function generate() {
    try {
      const password = generatePassword();
      setNewPassword(password);
      setConfirmPassword(password);
      setPasswordNotice(
        "A strong 24-character password was generated.",
      );
      setPasswordError("");
    } catch {
      setPasswordError("Secure password generation failed.");
    }
  }

  async function copyPassword() {
    if (!newPassword) return;

    try {
      await navigator.clipboard.writeText(newPassword);
      setPasswordNotice(
        "Password copied. Keep it in a password manager.",
      );
    } catch {
      setPasswordError("Unable to copy password.");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (savingPassword) return;

    setPasswordError("");
    setPasswordNotice("");

    if (newPassword.length < 12 || newPassword.length > 128) {
      setPasswordError(
        "Password must contain between 12 and 128 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "New password must differ from current password.",
      );
      return;
    }

    setSavingPassword(true);

    try {
      await profileApi<{ sessionsRevoked: boolean }>(
        "/password",
        {
          method: "PATCH",
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        },
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // All existing sessions were revoked by NestJS.
      window.location.replace("/admin/login");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Unable to change password.",
      );
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <LoaderCircle className="size-7 animate-spin text-[#6D5DF6]" />
      </div>
    );
  }

  const initials = (
    (firstName.charAt(0) + lastName.charAt(0)) ||
    email.slice(0, 2)
  ).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-[1050px] space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8592AF]">
          My Account
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#172444]">
          Profile Settings
        </h1>
        <p className="mt-1 text-sm text-[#8290AC]">
          Manage your personal details and account security.
        </p>
      </header>

      <section className="rounded-2xl border border-[#E9EDF6] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#EFECFF] text-xl font-bold text-[#6D5DF6]">
            {initials || <UserRound className="size-7" />}
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#172444]">
              {profile
                ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ||
                  profile.email
                : "Admin Profile"}
            </h2>
            <p className="mt-1 break-all text-sm text-[#8794AC]">
              {profile?.email}
            </p>
          </div>

          {profile?.isActive && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Check className="size-3.5" />
              Active
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9EDF6] bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#EFECFF] text-[#6D5DF6]">
            <UserRound className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172444]">
              Personal Information
            </h2>
            <p className="mt-1 text-xs text-[#8290AC]">
              Update your name and email address.
            </p>
          </div>
        </div>

        <form onSubmit={(event) => void saveInformation(event)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#465575]">
              First Name
              <input
                required
                maxLength={100}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
              />
            </label>

            <label className="text-xs font-semibold text-[#465575]">
              Last Name
              <input
                required
                maxLength={100}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-[#465575]">
            Email Address
            <input
              required
              type="email"
              maxLength={255}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
            />
          </label>

          {profileError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {profileError}
            </p>
          )}

          {profileNotice && (
            <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
              {profileNotice}
            </p>
          )}

          <div className="flex justify-end border-t border-[#EDF0F6] pt-5">
            <button
              type="submit"
              disabled={savingProfile || !profile}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingProfile ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[#E9EDF6] bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#EFECFF] text-[#6D5DF6]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172444]">
              Change Password
            </h2>
            <p className="mt-1 text-xs text-[#8290AC]">
              Verify your current password before changing it.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void changePassword(event)}
          className="space-y-5"
        >
          <PasswordField
            id="current-password"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autocomplete="current-password"
          />

          <div className="space-y-4 rounded-2xl border border-[#E9E5FF] bg-[#FBFAFF] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold text-[#465575]">
                <KeyRound className="size-4 text-[#6D5DF6]" />
                New Password
              </h3>

              <button
                type="button"
                onClick={generate}
                className="flex items-center gap-2 rounded-lg bg-[#EFEBFF] px-3 py-2 text-[11px] font-semibold text-[#6554D8] hover:bg-[#E8E1FF]"
              >
                <RefreshCw className="size-3.5" />
                Generate Strong Password
              </button>
            </div>

            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              minLength={12}
              maxLength={128}
              autocomplete="new-password"
            />

            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              minLength={12}
              maxLength={128}
              autocomplete="new-password"
            />

            {confirmPassword && (
              <p
                className={`text-xs font-semibold ${
                  newPassword === confirmPassword
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {newPassword === confirmPassword
                  ? "Passwords match"
                  : "Passwords do not match"}
              </p>
            )}

            <button
              type="button"
              disabled={!newPassword}
              onClick={() => void copyPassword()}
              className="flex items-center gap-2 rounded-lg border border-[#E8E4FF] bg-white px-3 py-2 text-xs font-semibold text-[#6554D8] disabled:opacity-40"
            >
              <Copy className="size-4" />
              Copy New Password
            </button>

            {passwordNotice && (
              <p role="status" className="text-xs text-[#6554D8]">
                {passwordNotice}
              </p>
            )}
          </div>

          {passwordError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {passwordError}
            </p>
          )}

          <p className="text-xs leading-5 text-[#8794AC]">
            After changing your password, all active sessions
            will be revoked and you will need to sign in again.
          </p>

          <div className="flex justify-end border-t border-[#EDF0F6] pt-5">
            <button
              type="submit"
              disabled={savingPassword || !profile}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingPassword ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Update Password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
