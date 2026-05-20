export function normalizeWorkspaceRole(role?: string | null): string {
  const normalized = (role ?? "").trim().toLowerCase().replaceAll("-", "_");

  switch (normalized) {
    case "sales":
      return "marketing";
    case "head":
      return "admin";
    case "superadmin":
      return "owner";
    default:
      return normalized;
  }
}

export function isOwnerLike(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "owner" || normalized === "super_admin";
}

export function isAdminLike(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "admin" || isOwnerLike(normalized);
}

export function isSalesLike(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "marketing";
}

export function getRoleDisplayLabel(role?: string | null): string {
  switch (normalizeWorkspaceRole(role)) {
    case "marketing":
      return "sales";
    case "admin":
      return "head";
    case "owner":
      return "superadmin";
    case "super_admin":
      return "platform superadmin";
    default:
      return (role ?? "").replaceAll("_", " ");
  }
}
