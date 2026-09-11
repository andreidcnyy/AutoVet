import { ROLES } from "../constants/roles";

/**
 * How a user's name and role are written wherever the app shows them.
 * Shared so the header and the user table cannot drift apart.
 */

/**
 * Veterinarians are addressed by title in the clinic, so a vet shows as
 * "Dr. Reyes" rather than the bare name. A name already entered as "Dr. …" is
 * left alone instead of being doubled up.
 */
export function displayUserName(user) {
  const name = user?.name?.trim();
  if (!name) return name;
  if (user?.role !== ROLES.VETERINARIAN) return name;
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

/** Roles are stored as snake_case keys; nothing should print them raw. */
export function roleLabel(role) {
  return (role || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
