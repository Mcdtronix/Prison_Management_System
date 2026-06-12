export const normalizeRole = (role?: string | null): string => {
  if (!role) {
    return "";
  }

  const normalized = role
    .trim()
    .toUpperCase()
    .replace(/[.\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const aliases: Record<string, string> = {
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN_OFFICER",
    ADMIN_OFFICER: "ADMIN_OFFICER",
    A_O: "ADMIN_OFFICER",
    AO: "ADMIN_OFFICER",
    RECEPTION: "RECEPTION_OFFICER",
    RECEPTION_OFFICER: "RECEPTION_OFFICER",
    R_O: "RECEPTION_OFFICER",
    RO: "RECEPTION_OFFICER",
    HEALTH: "HEALTH_OFFICER",
    HEALTH_OFFICER: "HEALTH_OFFICER",
    H_O: "HEALTH_OFFICER",
    HO: "HEALTH_OFFICER",
    STORES: "STORES_OFFICER",
    STORES_OFFICER: "STORES_OFFICER",
    S_O: "STORES_OFFICER",
    SO: "STORES_OFFICER",
    FARMS: "FARMS_OFFICER",
    FARMS_OFFICER: "FARMS_OFFICER",
    F_O: "FARMS_OFFICER",
    FO: "FARMS_OFFICER",
  };

  return aliases[normalized] || normalized;
};

export const getRoleDisplayName = (role?: string | null): string => {
  const normalizedRole = normalizeRole(role);

  const roleMap: Record<string, string> = {
    SUPER_ADMIN: "Super Administrator",
    ADMIN_OFFICER: "Admin Officer",
    RECEPTION_OFFICER: "Reception Officer",
    HEALTH_OFFICER: "Health Officer",
    STORES_OFFICER: "Stores Officer",
    FARMS_OFFICER: "Farms Officer",
  };

  if (roleMap[normalizedRole]) {
    return roleMap[normalizedRole];
  }

  return normalizedRole
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getDefaultRouteForRole = (role?: string | null): string => {
  switch (normalizeRole(role)) {
    case "SUPER_ADMIN":
    case "ADMIN_OFFICER":
      return "/admin";
    case "RECEPTION_OFFICER":
      return "/reception";
    case "HEALTH_OFFICER":
      return "/health";
    case "STORES_OFFICER":
      return "/stores";
    case "FARMS_OFFICER":
      return "/farms";
    default:
      return "/";
  }
};

export const getLandingRouteForUser = (role?: string | null, orgUnitType?: string | null, orgUnitId?: number | null): string => {
  const normalized = normalizeRole(role);

  // Only apply org-specific admin routing for admin roles
  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN_OFFICER') {
    if (orgUnitType === 'NATIONAL_HQ') return '/admin/nhq';
    if (orgUnitType === 'PROVINCIAL_HQ') return orgUnitId ? `/admin/phq/${orgUnitId}` : '/admin/phq';
    if (orgUnitType === 'STATION') return orgUnitId ? `/admin/station/${orgUnitId}` : '/admin/station';
    return '/admin';
  }

  return getDefaultRouteForRole(normalized);
};
