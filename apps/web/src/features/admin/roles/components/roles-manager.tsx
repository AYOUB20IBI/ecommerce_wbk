
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronDown,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Permission = {
  id: string;
  code: string;
  description: string | null;
};

type RolePermission = {
  id: string;
  code: string;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermission[];
};

type ApiResult<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type RoleForm = {
  name: string;
  description: string;
  permissionIds: string[];
};

const EMPTY_FORM: RoleForm = {
  name: "",
  description: "",
  permissionIds: [],
};

async function requestApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `/api/admin/management/${endpoint}`,
    {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
    },
  );

  let result: ApiResult<T>;

  try {
    result = (await response.json()) as ApiResult<T>;
  } catch {
    throw new Error("Invalid server response.");
  }

  if (response.status === 401) {
    window.location.replace("/admin/login");
    throw new Error("Session expired.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ??
        `Request failed (${response.status}).`,
    );
  }

  if (result.data === undefined) {
    throw new Error("Missing response data.");
  }

  return result.data;
}

function permissionModule(code: string): string {
  const separator = code.indexOf(".");
  return separator === -1
    ? "other"
    : code.slice(0, separator);
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function RoleBadge({ name }: { name: string }) {
  if (name === "super_admin") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
        <LockKeyhole className="size-3.5" />
        super_admin
      </span>
    );
  }

  return (
    <span className="rounded-lg bg-[#F0EDFF] px-2.5 py-1.5 text-[11px] font-semibold text-[#6554D8]">
      {name}
    </span>
  );
}

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [expandedModules, setExpandedModules] =
    useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [roleData, permissionData] = await Promise.all([
        requestApi<Role[]>("roles"),
        requestApi<Permission[]>("permissions"),
      ]);

      setRoles(roleData);
      setPermissions(permissionData);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load roles and permissions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const module = permissionModule(permission.code);
      const existing = groups.get(module) ?? [];
      existing.push(permission);
      groups.set(module, existing);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, items]) => ({
        module,
        items: items.sort((a, b) =>
          a.code.localeCompare(b.code),
        ),
      }));
  }, [permissions]);

  const filteredRoles = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return roles;

    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(keyword) ||
        (role.description ?? "")
          .toLowerCase()
          .includes(keyword),
    );
  }, [roles, search]);

  const permissionIdByCode = useMemo(
    () =>
      new Map(
        permissions.map((permission) => [
          permission.code,
          permission.id,
        ]),
      ),
    [permissions],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, permissionIds: [] });
    setExpandedModules({});
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    if (role.name === "super_admin") {
      setError(
        "The super_admin role is protected from permission changes.",
      );
      return;
    }

    const permissionIds = role.permissions
      .map((permission) =>
        permissionIdByCode.get(permission.code),
      )
      .filter((id): id is string => Boolean(id));

    setEditing(role);
    setForm({
      name: role.name,
      description: role.description ?? "",
      permissionIds,
    });
    setExpandedModules({});
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM, permissionIds: [] });
    setFormError("");
  }

  function togglePermission(id: string) {
    setForm((previous) => ({
      ...previous,
      permissionIds: previous.permissionIds.includes(id)
        ? previous.permissionIds.filter(
            (item) => item !== id,
          )
        : [...previous.permissionIds, id],
    }));
  }

  function toggleModule(items: Permission[]) {
    const ids = items.map((item) => item.id);

    setForm((previous) => {
      const current = new Set(previous.permissionIds);
      const allSelected = ids.every((id) => current.has(id));

      for (const id of ids) {
        if (allSelected) {
          current.delete(id);
        } else {
          current.add(id);
        }
      }

      return {
        ...previous,
        permissionIds: [...current],
      };
    });
  }

  function selectAll() {
    setForm((previous) => ({
      ...previous,
      permissionIds: permissions.map(
        (permission) => permission.id,
      ),
    }));
  }

  function clearAll() {
    setForm((previous) => ({
      ...previous,
      permissionIds: [],
    }));
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFormError("");
    setNotice("");

    const name = form.name.trim();

    if (!/^[a-z][a-z0-9_]{2,79}$/.test(name)) {
      setFormError(
        "Use a snake_case role name between 3 and 80 characters.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editing) {
        // The backend currently processes role metadata
        // and permission assignment in separate transactions.
        const detailsChanged =
          name !== editing.name ||
          form.description !== (editing.description ?? "");

        if (detailsChanged) {
          await requestApi(`roles/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name,
              description: form.description.trim() || null,
            }),
          });
        }

        const oldPermissions = editing.permissions
          .map((permission) =>
            permissionIdByCode.get(permission.code),
          )
          .filter((id): id is string => Boolean(id))
          .sort();

        const newPermissions = [...form.permissionIds].sort();

        if (
          JSON.stringify(oldPermissions) !==
          JSON.stringify(newPermissions)
        ) {
          await requestApi(
            `roles/${editing.id}/permissions`,
            {
              method: "PUT",
              body: JSON.stringify({
                permissionIds: form.permissionIds,
              }),
            },
          );
        }

        setNotice(
          "Role updated. Sessions affected by permission changes were revoked.",
        );
      } else {
        await requestApi("roles", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: form.description.trim() || null,
            permissionIds: form.permissionIds,
          }),
        });

        setNotice("Role created successfully.");
      }

      closeAfterSave();
      await loadData();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Unable to save role.",
      );

      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function closeAfterSave() {
    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM, permissionIds: [] });
    setFormError("");
  }

  async function deleteRole(role: Role) {
    if (role.name === "super_admin") {
      setError("Cannot delete the super_admin role.");
      return;
    }

    if (
      !window.confirm(
        `Delete role "${role.name}"? This action cannot be undone. Roles assigned to users cannot be deleted.`,
      )
    ) {
      return;
    }

    setDeletingId(role.id);
    setError("");
    setNotice("");

    try {
      await requestApi(`roles/${role.id}`, {
        method: "DELETE",
      });

      setNotice(`Role "${role.name}" deleted.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete role.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8592AF]">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172444]">
            Roles & Permissions
          </h1>
          <p className="mt-1 text-sm text-[#8290AC]">
            Control access to the store administration.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 text-xs font-semibold text-white hover:bg-[#5847E4] disabled:opacity-50"
        >
          <Plus className="size-4" />
          Create Role
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Total Roles",
            value: roles.length,
            icon: ShieldCheck,
          },
          {
            title: "Available Permissions",
            value: permissions.length,
            icon: KeyRound,
          },
          {
            title: "Permission Modules",
            value: permissionGroups.length,
            icon: Users,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-[#EBEDF5] bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#8290AC]">
                  {stat.title}
                </p>
                <Icon className="size-4 text-[#6D5DF6]" />
              </div>
              <p className="mt-3 text-2xl font-bold text-[#172444]">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E9EDF6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F6] p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-bold text-[#172444]">
              Access Roles
            </h2>
            <p className="mt-1 text-xs text-[#8B97B0]">
              {filteredRoles.length} roles
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#95A0B5]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search roles..."
              aria-label="Search roles"
              className="h-10 w-full rounded-xl border border-[#E8EBF3] bg-[#F9FAFD] pl-10 pr-3 text-xs outline-none focus:border-[#6D5DF6]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[690px] text-left">
            <thead className="bg-[#F9FAFD] text-[11px] uppercase tracking-wider text-[#8B97B0]">
              <tr>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Description</th>
                <th className="px-5 py-4">Permissions</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0F2F7]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <LoaderCircle className="mx-auto size-6 animate-spin text-[#6D5DF6]" />
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-12 text-center text-sm text-[#8290AC]"
                  >
                    No roles found.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => {
                  const protectedRole =
                    role.name === "super_admin";

                  return (
                    <tr key={role.id} className="hover:bg-[#FCFBFF]">
                      <td className="px-5 py-4">
                        <RoleBadge name={role.name} />
                      </td>

                      <td className="max-w-[270px] px-5 py-4 text-xs leading-5 text-[#7786A3]">
                        {role.description || "No description"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#F4F5FA] px-3 py-1.5 text-xs font-semibold text-[#52617F]">
                          {role.permissions.length}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={protectedRole}
                            onClick={() => openEdit(role)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E8E6FA] px-3 py-2 text-xs font-semibold text-[#6554D8] hover:bg-[#F7F5FF] disabled:opacity-40"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={
                              protectedRole ||
                              deletingId === role.id
                            }
                            onClick={() => void deleteRole(role)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                          >
                            {deletingId === role.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172444]/50 p-3 backdrop-blur-sm sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-form-heading"
            className="flex max-h-[95vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EDF0F6] px-5 py-5 sm:px-7">
              <div>
                <h2
                  id="role-form-heading"
                  className="text-lg font-bold text-[#172444]"
                >
                  {editing ? "Edit Role" : "Create Role"}
                </h2>
                <p className="mt-1 text-xs text-[#8794AC]">
                  Configure the role and its permissions.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close role form"
                className="rounded-lg p-2 text-[#7B89A6] hover:bg-[#F5F3FF]"
              >
                <X className="size-5" />
              </button>
            </header>

            <form
              onSubmit={(event) => void saveRole(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#465575]">
                    Role Name
                    <input
                      required
                      maxLength={80}
                      value={form.name}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="product_editor"
                      className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                    <span className="mt-1 block text-[10px] font-normal text-[#9AA5BA]">
                      Lowercase snake_case, 3–80 characters.
                    </span>
                  </label>

                  <label className="text-xs font-semibold text-[#465575]">
                    Description
                    <input
                      maxLength={1000}
                      value={form.description}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Can manage the product catalog"
                      className="mt-2 h-11 w-full rounded-xl border border-[#E5E9F2] px-3 text-sm outline-none focus:border-[#6D5DF6]"
                    />
                  </label>
                </div>

                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#172444]">
                        Permission Matrix
                      </h3>
                      <p className="mt-1 text-xs text-[#8794AC]">
                        {form.permissionIds.length} of{" "}
                        {permissions.length} selected
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="rounded-lg bg-[#F0EDFF] px-3 py-2 text-[11px] font-semibold text-[#6554D8]"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-lg border border-[#E8EAF4] px-3 py-2 text-[11px] font-semibold text-[#7584A1]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {permissionGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E5E9F2] p-8 text-center text-xs text-[#8794AC]">
                      No permissions found in the database.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {permissionGroups.map((group) => {
                        const selectedCount = group.items.filter(
                          (permission) =>
                            form.permissionIds.includes(permission.id),
                        ).length;

                        const allSelected =
                          selectedCount === group.items.length;

                        const expanded =
                          expandedModules[group.module] !== false;

                        return (
                          <div
                            key={group.module}
                            className="overflow-hidden rounded-xl border border-[#E8EAF4]"
                          >
                            <div className="flex items-center justify-between gap-3 bg-[#F9FAFD] p-3 sm:p-4">
                              <label className="flex min-w-0 items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(element) => {
                                    if (element) {
                                      element.indeterminate =
                                        selectedCount > 0 &&
                                        !allSelected;
                                    }
                                  }}
                                  onChange={() =>
                                    toggleModule(group.items)
                                  }
                                  className="size-4 accent-[#6D5DF6]"
                                />

                                <span className="min-w-0">
                                  <span className="block text-xs font-bold text-[#253352]">
                                    {humanize(group.module)}
                                  </span>
                                  <span className="mt-1 block text-[10px] text-[#8794AC]">
                                    {selectedCount} /{" "}
                                    {group.items.length} selected
                                  </span>
                                </span>
                              </label>

                              <button
                                type="button"
                                aria-label={`Toggle ${group.module} permissions`}
                                aria-expanded={expanded}
                                onClick={() =>
                                  setExpandedModules((previous) => ({
                                    ...previous,
                                    [group.module]: !expanded,
                                  }))
                                }
                                className="rounded-lg p-2 text-[#72819F] hover:bg-white"
                              >
                                <ChevronDown
                                  className={[
                                    "size-4 transition-transform",
                                    expanded ? "" : "-rotate-90",
                                  ].join(" ")}
                                />
                              </button>
                            </div>

                            {expanded && (
                              <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                                {group.items.map((permission) => {
                                  const checked =
                                    form.permissionIds.includes(
                                      permission.id,
                                    );

                                  return (
                                    <label
                                      key={permission.id}
                                      className={[
                                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                                        checked
                                          ? "border-[#DCD5FF] bg-[#F8F6FF]"
                                          : "border-[#EEF0F6] bg-white hover:bg-[#FAFAFE]",
                                      ].join(" ")}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          togglePermission(permission.id)
                                        }
                                        className="mt-0.5 size-4 accent-[#6D5DF6]"
                                      />

                                      <span className="min-w-0">
                                        <span className="block break-all text-xs font-semibold text-[#344362]">
                                          {permission.code}
                                        </span>

                                        {permission.description && (
                                          <span className="mt-1 block text-[11px] leading-5 text-[#8290AC]">
                                            {permission.description}
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {formError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
                  >
                    {formError}
                  </p>
                )}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EDF0F6] px-5 py-4 sm:px-7">
                <p className="hidden text-[11px] text-[#93A0B9] sm:block">
                  Role changes can revoke affected sessions.
                </p>

                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-10 rounded-xl border border-[#E5E9F2] px-4 text-xs font-semibold text-[#65738E]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex h-10 items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {saving
                      ? "Saving..."
                      : editing
                        ? "Save Role"
                        : "Create Role"}
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
