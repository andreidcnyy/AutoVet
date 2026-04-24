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
