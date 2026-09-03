/**
 * Pet image utilities — offline-safe.
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
 */
export const resolveMediaUrl = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (raw.startsWith('data:image')) return raw;

  const supabase = raw.match(SUPABASE_OBJECT_URL);
  if (supabase) {
    const path = supabase[1].split('?')[0].replace(/^\/+/, '');
    return path ? `/media/${path}` : undefined;
  }

  // Any other absolute URL (Google avatars, for instance) is left alone.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Bare path. Strip a leading slash and any storage/ or media/ prefix so the
  // result never doubles up into /media/media/...
  const path = raw.replace(/^\/+/, '').replace(/^(?:storage|media)\/+/i, '');
  return path ? `/media/${path}` : undefined;
};

/**
 * Returns the URL for a pet's actual uploaded photo.
 */
export const getActualPetImageUrl = (photoPath: string | null | undefined): string | undefined =>
  resolveMediaUrl(photoPath);

/**
 * onError handler for a pet <img>, swapping in the species artwork.
 *
 * A stored photo can fail to load for reasons the row cannot express: the
 * bytes were never migrated out of the retired bucket, or the key no longer
 * matches. Without this the browser paints its broken-image glyph, which is
 * what "the images are not appearing" looks like on screen.
 */
export const onPetImageError =
  (species: any, breed?: any) => (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    img.onerror = null; // never allow the fallback itself to loop
    const fallback = getPetImageUrl(species, breed);
    if (img.getAttribute('src') !== fallback) img.src = fallback;
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
