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
 * Matches a Supabase storage URL and captures the object path after the bucket,
 * covering the public, authenticated, signed and S3-style forms.
 */
const SUPABASE_OBJECT_URL =
  /^https?:\/\/[^/]*supabase\.(?:co|in)\/storage\/v1\/(?:object\/(?:public|authenticated|sign)|s3)\/[^/]+\/(.+)$/i;

/**
 * Resolves any stored image reference to something this app can actually load.
 *
 * Rows written before image bytes moved into the database hold an absolute
 * Supabase URL, because the old uploader returned Storage::disk('s3')->url().
 * That project is gone, so those URLs resolve to nothing. The object path at
 * the end of the URL is the same key the bytes now live under, so rewrite it
 * to /media/<path> rather than handing the browser a dead host.
 *
 * Returns null when there is nothing loadable.
 */
export const resolveMediaUrl = (value) => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith('data:image')) return raw;

  const supabase = raw.match(SUPABASE_OBJECT_URL);
  if (supabase) {
    const path = supabase[1].split('?')[0].replace(/^\/+/, '');
    return path ? `/media/${path}` : null;
  }

  // Any other absolute URL (Google avatars, for instance) is left alone.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Bare path. Strip a leading slash and any storage/ or media/ prefix so the
  // result never doubles up into /media/media/...
  const path = raw.replace(/^\/+/, '').replace(/^(?:storage|media)\/+/i, '');
  return path ? `/media/${path}` : null;
};

/**
 * Returns the URL for a pet's actual uploaded photo.
 * Falls through to getPetImageUrl for species-based fallback if no photo.
 */
export const getActualPetImageUrl = (photoPath) => resolveMediaUrl(photoPath);

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
