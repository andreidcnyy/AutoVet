/**
 * Authoritative Application Roles
 * Aligned with Backend Enum (App\Enums\Roles)
 */
export const ROLES = {
  ADMIN: "admin",
  VETERINARIAN: "veterinarian",
  STAFF: "staff",
};

/**
 * Standardized Access Groups
 */
export const ADMIN_ONLY = [ROLES.ADMIN];
export const VET_AND_ADMIN = [ROLES.ADMIN, ROLES.VETERINARIAN];
export const ALL_ROLES = [ROLES.ADMIN, ROLES.VETERINARIAN, ROLES.STAFF];

// Legacy group support (Mapping to new groups for compatibility during transition)
export const FULL_ACCESS_ROLES = ADMIN_ONLY; // Updated to Admin-only for sensitive pages
export const ALL_STAFF_ROLES = ALL_ROLES;
