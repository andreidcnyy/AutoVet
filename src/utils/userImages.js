/**
 * User avatar utilities — offline-safe.
 *
 * All external Unsplash photo URLs and ui-avatars.com API calls have been
 * replaced with local SVG assets served from /public/images/fallbacks/.
 * These work fully offline without any internet dependency.
 */

/**
 * Returns the appropriate local SVG avatar for a user based on their role.
 * Falls back to user-default.svg if role is unrecognized.
 *
 * @param {string} role - The user's role string from the API
 * @param {string} name - The user's display name (kept for future initials support)
 */
export const getUserAvatarUrl = (role, name) => {
  const r = role?.toLowerCase() || "";

  // Admin / Executive
  if (r.includes("admin")) {
    return "/images/fallbacks/user-admin.svg";
  }

  // Chief Veterinarian or Veterinarian
  if (r.includes("veterinarian") || r.includes("vet") || r.includes("chief")) {
    return "/images/fallbacks/user-vet.svg";
  }

  // Staff, Nurse, Receptionist, or any support role
  if (
    r.includes("staff") ||
    r.includes("nurse") ||
    r.includes("receptionist") ||
    r.includes("technician")
  ) {
    return "/images/fallbacks/user-staff.svg";
  }

  // Default — neutral silhouette for unrecognized roles
  return "/images/fallbacks/user-default.svg";
};
