
import type { AdminUser } from "@/lib/auth/admin-server";

type Props = {
  admin: AdminUser;
  compact?: boolean;
};

export function getAdminDisplayName(admin: AdminUser): string {
  const name = [admin.firstName, admin.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || admin.email;
}

export function getAdminRoleLabel(admin: AdminUser): string {
  return admin.roles.length > 0
    ? admin.roles.join(", ")
    : "No role assigned";
}

export function AdminProfile({
  admin,
  compact = false,
}: Props) {
  const name = getAdminDisplayName(admin);
  const role = getAdminRoleLabel(admin);

  const initials =
    [admin.firstName, admin.lastName]
      .filter(Boolean)
      .map((value) => value!.trim().charAt(0))
      .join("")
      .toUpperCase() ||
    admin.email.slice(0, 2).toUpperCase();

  return (
    <div
      className={[
        "flex min-w-0 items-center",
        compact ? "justify-center" : "gap-3",
      ].join(" ")}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-bold text-[#6D5DF6]">
        {initials}
      </span>

      {!compact && (
        <div className="min-w-0">
          <p
            className="truncate text-xs font-semibold text-[#1E2B4A]"
            title={name}
          >
            {name}
          </p>
          <p
            className="mt-0.5 truncate text-[10px] text-[#91A0BA]"
            title={role}
          >
            {role}
          </p>
        </div>
      )}
    </div>
  );
}
