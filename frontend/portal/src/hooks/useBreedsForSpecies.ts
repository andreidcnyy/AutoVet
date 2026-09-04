import { useEffect, useRef, useState } from 'react';
import { getBreeds } from '../api';
import { readCache, writeCache } from '../utils/swrCache';

/**
 * Breed options for the currently selected species.
 *
 * This logic existed in three copies (Add Pet, Edit Pet, the edit modal), each
 * with the same three faults that let a dog be saved with a cat's breed:
 *
 *   1. The previous species' breeds stayed on screen while the new ones
 *      loaded, so a dog really did show cat options.
 *   2. Nothing cleared the chosen breed_id when the species changed, so a
 *      breed picked under the old species stayed selected — and got saved.
 *   3. Two quick species changes raced: the slower response could land last
 *      and repopulate the list with the wrong species' breeds.
 *
 * onSpeciesChanged fires only when the species actually changes away from a
 * previous value, never on the initial hydrate, so opening an existing pet for
 * editing keeps the breed it was saved with.
 */
export function useBreedsForSpecies(
  // react-hook-form's watch() is typed unknown; normalised below.
  speciesId: unknown,
  speciesList: any[],
  onSpeciesChanged?: () => void
) {
  const [breeds, setBreeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Identifies the newest request, so a stale one cannot overwrite it.
  const requestRef = useRef(0);
  // Tracks the species the list currently belongs to.
  const previousSpecies = useRef<string | null>(null);

  const key =
    speciesId === null || speciesId === undefined || speciesId === '' ? '' : String(speciesId);

  useEffect(() => {
    const hadPrevious = previousSpecies.current !== null;
    const changed = previousSpecies.current !== key;
    previousSpecies.current = key;

    // A real change away from an earlier species invalidates the chosen breed.
    if (changed && hadPrevious) onSpeciesChanged?.();

    if (!key) {
      setBreeds([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    const isCurrent = () => requestRef.current === requestId;

    // Species payloads sometimes embed their own breeds; use them directly.
    const embedded = speciesList.find((s) => String(s.id) === key);
    if (embedded?.breeds?.length) {
      setBreeds(embedded.breeds);
      setLoading(false);
      return;
    }

    const cacheKey = `portal_breeds_${key}_cache`;
    const cached = readCache<any[]>(cacheKey);

    // Show this species' cached breeds if we have them; otherwise show nothing
    // rather than the previous species' list.
    setBreeds(cached ?? []);
    setLoading(!cached);

    getBreeds(Number(key))
      .then((res) => {
        if (!isCurrent()) return; // a newer species was picked meanwhile
        const data = res.data?.data || res.data;
        const list = Array.isArray(data) ? data : [];
        setBreeds(list);
        writeCache(cacheKey, list);
      })
      .catch((err) => {
        if (isCurrent()) console.error('Failed to load breeds:', err);
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    // onSpeciesChanged is intentionally excluded: callers pass an inline
    // closure, and depending on it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, speciesList]);

  return { breeds, loading };
}
