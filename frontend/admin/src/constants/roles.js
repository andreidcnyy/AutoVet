/**
 * Authoritative Application Roles
 * Aligned with Backend Enum (App\Enums\Roles)
 */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  CLINIC_ADMIN: "clinic_admin",
  VETERINARIAN: "veterinarian",
  STAFF: "staff",
  OWNER: "owner",
};

/**
 * Standardized Access Groups
 */
export const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];
export const CLINIC_ADMIN_ONLY = [ROLES.CLINIC_ADMIN];

// Roles that operate WITHIN a clinic
export const CLINIC_STAFF_ROLES = [ROLES.CLINIC_ADMIN, ROLES.VETERINARIAN, ROLES.STAFF];
export const CLINIC_ADMIN_GROUP = [ROLES.CLINIC_ADMIN];
export const VET_AND_ADMIN = [ROLES.CLINIC_ADMIN, ROLES.VETERINARIAN];

// Legacy / Broad groups - strictly exclude SUPER_ADMIN from clinic-level data groups
export const ALL_ROLES = [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.VETERINARIAN, ROLES.STAFF];
export const ADMIN_ONLY = [ROLES.CLINIC_ADMIN]; // Clinic level admin only
export const FULL_ACCESS_ROLES = [ROLES.CLINIC_ADMIN, ROLES.VETERINARIAN];

// Mirrors Roles::rank() / Roles::canManage() on the server, so the users
// screen only offers what the server will accept: managers work up to their
// own rank, everyone else strictly below theirs.
const ROLE_RANK = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.CLINIC_ADMIN]: 3,
  [ROLES.VETERINARIAN]: 2,
  [ROLES.STAFF]: 1,
};
const MANAGER_ROLES = [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN];

export const canManageRole = (actorRole, targetRole) => {
  const actor = ROLE_RANK[actorRole] || 0;
  const target = ROLE_RANK[targetRole] || 0;
  if (!target) return false;
  return MANAGER_ROLES.includes(actorRole) ? target <= actor : target < actor;
};
