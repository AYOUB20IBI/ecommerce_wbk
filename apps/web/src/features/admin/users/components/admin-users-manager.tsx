
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type Role = {
  id: string;
  name: string;
  description?: string | null;
};

type Admin = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  roles: Role[];
};

type UsersResult = {
  items: Admin[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
};

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  changePassword: boolean;
  roleIds: string[];
};

const EMPTY: Form = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  changePassword: false,
  roleIds: [],
};

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `/api/admin/management/${path}`,
    {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
    },
  );

  const result: {
    success?: boolean;
    message?: string;
    data?: T;
  } = await response.json();

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || `Request failed (${response.status})`,
    );
  }

  if (result.data === undefined) {
    throw new Error("Invalid API response.");
  }

  return result.data;
}

function secureInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 256) {
    throw new Error("Invalid random range.");
  }

  const bytes = new Uint8Array(1);
  const limit = 256 - (256 % max);

  while (true) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return bytes[0] % max;
  }
}

function generatePassword(): string {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*-_+=?",
  ];

  const all = groups.join("");
  const result = groups.map(
    (group) => group[secureInt(group.length)],
  );

  while (result.length < 24) {
    result.push(all[secureInt(all.length)]);
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}

function nameOf(user: Admin): string {
  return (
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ") || user.email
  );
}

export function AdminUsersManager({
  currentAdminId,
}: {
  currentAdminId: string;
}) {
  const [users, setUsers] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editing, setEditing] = useState<Admin | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ ...EMPTY });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordNote, setPasswordNote] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setKeyword(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search: keyword,
      });

      const data = await api<UsersResult>(
        `users?${params}`,
      );

      setUsers(data.items);
      setTotal(data.pagination.total);
      setTotalPages(Math.max(1, data.pagination.totalPages));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load users.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;

    api<Role[]>("users/roles")
      .then((data) => {
        if (active) setRoles(data);
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Unable to load roles.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, roleIds: [] });
    setShowPassword(false);
    setShowConfirm(false);
    setPasswordNote("");
    setFormError("");
    setOpen(true);
  }

  function openEdit(user: Admin) {
    setEditing(user);
    setForm({
      ...EMPTY,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email,
      roleIds: user.roles.map((role) => role.id),
    });
    setShowPassword(false);
    setShowConfirm(false);
    setPasswordNote("");
    setFormError("");
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY });
    setPasswordNote("");
    setFormError("");
  }

  function toggleRole(id: string) {
    setForm((previous) => ({
      ...previous,
      roleIds: previous.roleIds.includes(id)
        ? previous.roleIds.filter((value) => value !== id)
        : [...previous.roleIds, id],
    }));
  }

  function generate() {
    try {
      const password = generatePassword();

      setForm((previous) => ({
        ...previous,
        password,
        confirmPassword: password,
        changePassword: true,
      }));

      setShowPassword(true);
      setShowConfirm(false);
      setPasswordNote(
        "Strong password generated and confirmation filled.",
      );
    } catch {
      setPasswordNote("Unable to generate a secure password.");
    }
  }

  async function copyPassword() {
    if (!form.password) return;

    try {
      await navigator.clipboard.writeText(form.password);
      setPasswordNote("Password copied to clipboard.");
    } catch {
      setPasswordNote("Unable to copy password.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFormError("");
    setNotice("");

    const changingPassword =
      !editing || form.changePassword;

    if (changingPassword) {
      if (form.password.length < 12 || form.password.length > 128) {
        setFormError(
          "Password must contain 12 to 128 characters.",
        );
        return;
      }

      if (form.password !== form.confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    if (form.roleIds.length === 0) {
      setFormError("Select at least one role.");
      return;
    }

    setSaving(true);

    try {
      const profile = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
      };

      if (!editing) {
        await api("users", {
          method: "POST",
          body: JSON.stringify({
            ...profile,
            password: form.password,
            roleIds: form.roleIds,
          }),
        });

        setNotice("Admin account created successfully.");
      } else {
        await api(`users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(profile),
        });

        const oldRoles = editing.roles
          .map((role) => role.id)
          .sort()
          .join(",");

        const newRoles = [...form.roleIds]
          .sort()
          .join(",");

        if (
          editing.id !== currentAdminId &&
          oldRoles !== newRoles
        ) {
          await api(`users/${editing.id}/roles`, {
            method: "PUT",
            body: JSON.stringify({
              roleIds: form.roleIds,
            }),
          });
        }

        if (form.changePassword) {
          await api(`users/${editing.id}/password`, {
            method: "PATCH",
            body: JSON.stringify({
              password: form.password,
              confirmPassword: form.confirmPassword,
            }),
          });
        }

        setNotice(
          form.changePassword
            ? "Account updated. Previous sessions revoked."
            : "Admin account updated.",
        );
      }

      const changedOwnPassword =
        editing?.id === currentAdminId &&
        form.changePassword;

      setOpen(false);
      setEditing(null);
      setForm({ ...EMPTY });

      if (changedOwnPassword) {
        window.location.replace("/admin/login");
        return;
      }

      await reload();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Unable to save account.",
      );
      // The backend currently handles profile, roles and
      // password changes as separate transactions.
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: Admin) {
    if (user.id === currentAdminId) return;

    if (
      !window.confirm(
        `${user.isActive ? "Disable" : "Enable"} ${nameOf(user)}?`,
      )
    ) {
      return;
    }

    setBusyId(user.id);
    setNotice("");
    setError("");

    try {
      await api(`users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      setNotice("Account status updated.");
      await reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update status.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const changingPassword = !editing || form.changePassword;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8592AF]">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#172444]">
            Admin Users
          </h1>
          <p className="mt-1 text-sm text-[#8290AC]">
            Manage staff, roles and account security.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 text-xs font-semibold text-white hover:bg-[#5847E4]"
        >
          <Plus className="size-4" />
          Add Admin
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total Admins", total, Users],
          [
            "Active on this page",
            users.filter((user) => user.isActive).length,
            Check,
          ],
          ["Available Roles", roles.length, ShieldCheck],
        ].map(([label, value, Icon]) => {
          const IconComponent = Icon as typeof Users;
          return (
            <div
              key={String(label)}
              className="rounded-2xl border border-[#EBEDF5] bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#8290AC]">
                  {String(label)}
                </p>
                <IconComponent className="size-4 text-[#6D5DF6]" />
              </div>
              <p className="mt-3 text-2xl font-bold text-[#172444]">
                {String(value)}
              </p>
            </div>
          );
        })}
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E9EDF6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F6] p-5">
          <div>
            <h2 className="text-sm font-bold text-[#172444]">
              Staff Accounts
            </h2>
            <p className="mt-1 text-xs text-[#8B97B0]">
              {total} matching accounts
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#95A0B5]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
              className="h-10 w-full rounded-xl border border-[#E8EBF3] bg-[#F9FAFD] pl-10 pr-3 text-xs outline-none focus:border-[#6D5DF6]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-[#F9FAFD] text-[11px] uppercase tracking-wide text-[#8B97B0]">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Roles</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0F2F7]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <LoaderCircle className="mx-auto size-6 animate-spin text-[#6D5DF6]" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm text-[#8290AC]">
                    No admin accounts found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#FCFBFF]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFECFF] text-xs font-bold text-[#6D5DF6]">
                          {nameOf(user).slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-[#253352]">
                            {nameOf(user)}
                            {user.id === currentAdminId && " (You)"}
                          </p>
                          <p className="mt-1 text-[11px] text-[#8795AE]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className="rounded-lg bg-[#F0EDFF] px-2 py-1 text-[10px] font-semibold text-[#6554D8]"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        {user.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-[#8290AC]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="flex items-center gap-1 rounded-lg border border-[#E8E6FA] px-3 py-2 text-xs font-semibold text-[#6554D8]"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId === user.id ||
                            user.id === currentAdminId
                          }
                          onClick={() => void toggleStatus(user)}
                          className="rounded-lg bg-[#F6F5FF] px-3 py-2 text-xs font-semibold text-[#6554D8] disabled:opacity-40"
                        >
                          {busyId === user.id
                            ? "Saving..."
                            : user.isActive
                              ? "Disable"
                              : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-[#EDF0F6] px-5 py-4">
          <p className="text-xs text-[#8290AC]">
            Page {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
              aria-label="Previous page"
              className="rounded-lg border p-2 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
              aria-label="Next page"
              className="rounded-lg border p-2 disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </footer>
      </section>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172444]/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-form-title"
            className="max-h-[95vh] w-full max-w-[580px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2
                  id="admin-form-title"
                  className="text-lg font-bold text-[#172444]"
                >
                  {editing ? "Edit Admin" : "Create Admin"}
                </h2>
                <p className="mt-1 text-xs text-[#8794AC]">
                  Account information, roles and password.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close"
                className="rounded-lg p-2 hover:bg-[#F6F5FF]"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(event) => void save(event)}
              className="mt-6 space-y-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["firstName", "First Name"],
                    ["lastName", "Last Name"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="text-xs font-semibold text-[#465575]"
                  >
                    {label}
                    <input
                      required
                      maxLength={100}
                      value={form[key]}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </label>
                ))}
              </div>

              <label className="block text-xs font-semibold text-[#465575]">
                Email
                <input
                  required
                  type="email"
                  autoComplete="off"
                  maxLength={255}
                  value={form.email}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                />
              </label>

              {/* Edit mode: opt-in password change */}
              {editing && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E8E4FF] bg-[#F9F8FF] p-4">
                  <input
                    type="checkbox"
                    checked={form.changePassword}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        changePassword: event.target.checked,
                        password: "",
                        confirmPassword: "",
                      }))
                    }
                    className="size-4 accent-[#6D5DF6]"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#465575]">
                      Change Password
                    </p>
                    <p className="mt-1 text-[11px] text-[#8794AC]">
                      Optional. Leave disabled to keep the current password.
                    </p>
                  </div>
                </label>
              )}

              {changingPassword && (
                <section className="space-y-4 rounded-2xl border border-[#E9E5FF] bg-[#FBFAFF] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#465575]">
                      {editing ? "New Password" : "Account Password"}
                    </h3>

                    <button
                      type="button"
                      onClick={generate}
                      className="flex items-center gap-2 rounded-lg bg-[#EFEBFF] px-3 py-2 text-[11px] font-semibold text-[#6554D8]"
                    >
                      <RefreshCw className="size-3.5" />
                      Generate Strong Password
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="new-admin-password"
                      className="text-xs font-semibold text-[#465575]"
                    >
                      {editing ? "New Password" : "Password"}
                    </label>

                    <div className="relative mt-2">
                      <input
                        id="new-admin-password"
                        required
                        type={showPassword ? "text" : "password"}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        spellCheck={false}
                        value={form.password}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            password: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-[#E5E9F2] bg-white pl-3 pr-12 text-sm outline-none focus:border-[#6D5DF6]"
                      />

                      <button
                        type="button"
                        title={showPassword ? "Hide" : "Show"}
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#8794AC]"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-admin-password"
                      className="text-xs font-semibold text-[#465575]"
                    >
                      Confirm Password
                    </label>

                    <div className="relative mt-2">
                      <input
                        id="confirm-admin-password"
                        required
                        type={showConfirm ? "text" : "password"}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        spellCheck={false}
                        value={form.confirmPassword}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            confirmPassword: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-[#E5E9F2] bg-white pl-3 pr-12 text-sm outline-none focus:border-[#6D5DF6]"
                      />

                      <button
                        type="button"
                        title={showConfirm ? "Hide" : "Show"}
                        aria-label={
                          showConfirm
                            ? "Hide confirmation"
                            : "Show confirmation"
                        }
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#8794AC]"
                      >
                        {showConfirm ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>

                    {form.confirmPassword && (
                      <p
                        className={[
                          "mt-2 text-[11px] font-semibold",
                          form.password === form.confirmPassword
                            ? "text-emerald-600"
                            : "text-red-600",
                        ].join(" ")}
                      >
                        {form.password === form.confirmPassword
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!form.password}
                    onClick={() => void copyPassword()}
                    className="flex items-center gap-2 rounded-lg border border-[#E8E4FF] bg-white px-3 py-2 text-xs font-semibold text-[#6554D8] disabled:opacity-40"
                  >
                    <Copy className="size-3.5" />
                    Copy Password
                  </button>

                  {passwordNote && (
                    <p role="status" className="text-[11px] text-[#6554D8]">
                      {passwordNote}
                    </p>
                  )}

                  <p className="text-[11px] leading-5 text-[#8794AC]">
                    12–128 characters. Changing a password revokes all
                    previous sessions for this account.
                  </p>
                </section>
              )}

              <fieldset
                disabled={editing?.id === currentAdminId}
                className="rounded-xl border border-[#E8EAF4] p-4"
              >
                <legend className="px-2 text-xs font-bold text-[#465575]">
                  Assigned Roles
                </legend>

                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FAFAFE] p-3 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="accent-[#6D5DF6]"
                      />
                      <span className="text-[#465575]">
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>

                {editing?.id === currentAdminId && (
                  <p className="mt-2 text-[11px] text-[#A07F55]">
                    You cannot change your own roles.
                  </p>
                )}
              </fieldset>

              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
                >
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-[#EEF0F6] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 rounded-xl border px-5 text-xs font-semibold text-[#65738E]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
