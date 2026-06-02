export function normalizeWorkspaceRole(role?: string | null): string {
  const normalized = (role ?? "").trim().toLowerCase().replaceAll("-", "_");

  switch (normalized) {
    case "marketing":
      return "sales";
    case "admin":
      return "head";
    case "owner":
    case "super_admin":
      return "superadmin";
    default:
      return normalized;
  }
}

export function isOwnerLike(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "superadmin";
}

export function isSuperadminRole(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "superadmin";
}

export function isHeadRole(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "head";
}

export function isManagerRole(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "manager";
}

export function isAdminLike(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "head" || isOwnerLike(normalized);
}

export function isManagerLike(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "manager" || isAdminLike(normalized);
}

export function canLeadSalesTeam(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "manager";
}

export function isSalesLike(role?: string | null): boolean {
  return normalizeWorkspaceRole(role) === "sales";
}

export function canAccessQueueAndActionCenter(role?: string | null): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === "sales" || normalized === "superadmin";
}

export function canAccessManagerInsights(role?: string | null): boolean {
  return isManagerLike(role);
}

export function canAccessStrategicInsights(role?: string | null): boolean {
  return isAdminLike(role);
}

export function canAccessAdminPages(role?: string | null): boolean {
  return isAdminLike(role);
}

export function getRoleDisplayLabel(role?: string | null): string {
  switch (normalizeWorkspaceRole(role)) {
    case "sales":
      return "sales";
    case "manager":
      return "manager";
    case "head":
      return "head";
    case "superadmin":
      return "superadmin";
    default:
      return (role ?? "").replaceAll("_", " ");
  }
}
