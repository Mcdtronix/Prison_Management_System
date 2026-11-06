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
    REC: "RECEPTION_OFFICER",
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
    // System-administrator roles route to the existing admin screens until
    // the dedicated admin console lands. The server decides what they may do.
    NATIONAL_SYSTEM_ADMIN: "HQ_SYS_ADMIN",
    HQ_SYSTEM_ADMIN: "HQ_SYS_ADMIN",
    // Provincial system admins use the console, limited to their province.
    PROVINCIAL_SYSTEM_ADMIN: "PROV_SYS_ADMIN",
    PROV_SYS_ADMIN: "PROV_SYS_ADMIN",
    // Station system admins use the console, limited to their station.
    STATION_SYSTEM_ADMIN: "STN_SYS_ADMIN",
    STN_SYS_ADMIN: "STN_SYS_ADMIN",
    SYS_ADMIN: "ADMIN_OFFICER",
    ADMINISTRATION: "ADMIN_OFFICER",
    SECURITY: "SECURITY_OFFICER",
    REHABILITATION: "REHABILITATION_OFFICER",
  };

  return aliases[normalized] || normalized;
};

export const getRoleDisplayName = (role?: string | null): string => {
  const normalizedRole = normalizeRole(role);

  const roleMap: Record<string, string> = {
    HQ_SYS_ADMIN: "HQ System Admin",
    PROV_SYS_ADMIN: "Provincial System Admin",
    STN_SYS_ADMIN: "Station System Admin",
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

/** Roles that use the HQ System Admin console (/hq). */
export const HQ_CONSOLE_ROLES = ["HQ_SYS_ADMIN", "SUPER_ADMIN"];

/** Roles that use the console at all. The server limits each one to its own area. */
export const CONSOLE_ROLES = [...HQ_CONSOLE_ROLES, "PROV_SYS_ADMIN", "STN_SYS_ADMIN"];

export const getDefaultRouteForRole = (role?: string | null): string => {
  switch (normalizeRole(role)) {
    case "HQ_SYS_ADMIN":
    case "SUPER_ADMIN":
    case "PROV_SYS_ADMIN":
    case "STN_SYS_ADMIN":
      return "/hq";
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

  // HQ System Admins (and legacy super admins) have their own console.
  if (CONSOLE_ROLES.includes(normalized)) return '/hq';

  // Administration officers use the station admin dashboard. (The per-level
  // /admin/nhq, /admin/phq and /admin/station pages were never built.)
  if (normalized === 'ADMIN_OFFICER') return '/admin';

  return getDefaultRouteForRole(normalized);
};
