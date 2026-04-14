/**
 * Pet image utilities — offline-safe.
 */

/**
 * Returns the URL for a pet's actual uploaded photo.
 */
export const getActualPetImageUrl = (photoPath: string | null | undefined): string | undefined => {
  if (!photoPath) return undefined;
  // Already an absolute URL (e.g., data: URI or a previously resolved http URL)
  if (photoPath.startsWith("http") || photoPath.startsWith("data:image")) return photoPath;
  // Local Laravel storage path
  return `http://localhost:8000/storage/${photoPath}`;
};

/**
 * Returns the best-matching local SVG fallback image for a pet
 */
export const getPetImageUrl = (species: any, breed: any) => {
  const s = (typeof species === "string" ? species : species?.name || "").toLowerCase();
  // const b = (typeof breed === "string" ? breed : breed?.name || "").toLowerCase();

  if (s.includes("dog") || s === "canine") return "/images/fallbacks/pet-dog.svg";
  if (s.includes("cat") || s === "feline") return "/images/fallbacks/pet-cat.svg";
  if (s.includes("bird") || s.includes("parrot") || s.includes("avian")) return "/images/fallbacks/pet-bird.svg";
  if (s.includes("rabbit") || s.includes("bunny")) return "/images/fallbacks/pet-rabbit.svg";
  
  return "/images/fallbacks/pet-default.svg";
};
