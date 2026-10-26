
export type AdminAccess = {
  adminId: string;
  roles: string[];
  permissions: string[];
};

export function hasPermission(
  access: AdminAccess,
  permission: string,
): boolean {
  return access.permissions.includes(permission);
}

export function hasAllPermissions(
  access: AdminAccess,
  required: readonly string[],
): boolean {
  return (
    required.length > 0 &&
    required.every((permission) =>
      hasPermission(access, permission),
    )
  );
}

export function hasAnyPermission(
  access: AdminAccess,
  required: readonly string[],
): boolean {
  return (
    required.length > 0 &&
    required.some((permission) =>
      hasPermission(access, permission),
    )
  );
}
