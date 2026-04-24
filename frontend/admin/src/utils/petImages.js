/**
 * Pet image utilities — offline-safe.
 *
 * getActualPetImageUrl: For pets with a real uploaded photo stored locally.
 *   Returns the local Laravel storage URL. No internet required.
 *
 * getPetImageUrl: Species/breed-based fallback when no photo exists.
 *   Returns local SVG assets — fully functional offline.
 *   All Unsplash external URLs have been removed.
 */

/**
 * Returns the URL for a pet's actual uploaded photo.
 * Falls through to getPetImageUrl for species-based fallback if no photo.
 */
export const getActualPetImageUrl = (photoPath) => {
  if (!photoPath) return null;
  
  // 1. Already an absolute URL or Data URI
  if (typeof photoPath === 'string' && (photoPath.startsWith("http") || photoPath.startsWith("data:image"))) {
    return photoPath;
  }

  // 2. If it already starts with /storage
  if (typeof photoPath === 'string' && photoPath.startsWith("/storage")) {
    return photoPath;
  }

  // 3. Local Laravel storage path — served by the local backend via proxy
  return `/storage/${photoPath}`;
};

/**
 * Returns the best-matching local SVG fallback image for a pet
 * based on its species and breed. Fully offline-capable.
 */
export const getPetImageUrl = (species, breed) => {
  const s = (typeof species === "string" ? species : species?.name || "").toLowerCase();
  const b = (typeof breed === "string" ? breed : breed?.name || "").toLowerCase();

  // ── Dogs / Canines ──────────────────────────────────────────────────────────
  if (s.includes("dog") || s === "canine") {
    return "/images/fallbacks/pet-dog.svg";
  }

  // ── Cats / Felines ──────────────────────────────────────────────────────────
  if (s.includes("cat") || s === "feline") {
    return "/images/fallbacks/pet-cat.svg";
  }

  // ── Birds & Parrots ─────────────────────────────────────────────────────────
  if (s.includes("bird") || s.includes("parrot") || s.includes("avian")) {
    return "/images/fallbacks/pet-bird.svg";
  }

  // ── Rabbits ─────────────────────────────────────────────────────────────────
  if (s.includes("rabbit") || s.includes("bunny")) {
    return "/images/fallbacks/pet-rabbit.svg";
  }

  // ── Small mammals (hamster, guinea pig, etc.) — use rabbit as closest match
  if (s.includes("hamster") || s.includes("guinea pig") || s.includes("gerbil")) {
    return "/images/fallbacks/pet-rabbit.svg";
  }

  // ── Reptiles & Fish — use generic default
  if (
    s.includes("reptile") ||
    s.includes("snake") ||
    s.includes("lizard") ||
    s.includes("fish")
  ) {
    return "/images/fallbacks/pet-default.svg";
  }

  // ── Ultimate fallback (paw print) ────────────────────────────────────────
  return "/images/fallbacks/pet-default.svg";
};
