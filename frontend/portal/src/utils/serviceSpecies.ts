/**
 * Matching services to the species of the pet being booked for.
 *
 * Services carry no species column or pivot — the only signal is the name,
 * where a handful are marked "(Dogs)" or "(Cats)". So a service is hidden only
 * when its name calls out a species other than the selected pet's. Anything
 * that names no species at all — consultations, deworming, grooming, lab work,
 * which is most of the catalogue — stays available for every pet.
 *
 * Deliberately conservative: a service is only removed on positive evidence
 * that it belongs to another species. Getting it wrong by hiding a service the
 * clinic does offer is worse than showing one extra.
 */
const SPECIES_TOKENS: Record<string, string[]> = {
  canine: ['dog', 'dogs', 'canine', 'canines', 'puppy', 'puppies'],
  feline: ['cat', 'cats', 'feline', 'felines', 'kitten', 'kittens'],
  bird: ['bird', 'birds', 'avian'],
  rabbit: ['rabbit', 'rabbits', 'bunny', 'bunnies'],
  'guinea pig': ['guinea pig', 'guinea pigs', 'cavy'],
  hamster: ['hamster', 'hamsters'],
};

/** Normalises a species name from the API ("Canine", "Feline") to a token key. */
function speciesKey(speciesName?: string | null): string | null {
  if (!speciesName) return null;
  const name = speciesName.trim().toLowerCase();
  if (SPECIES_TOKENS[name]) return name;

  // Tolerate a species recorded as "Dog" or "Cat" rather than "Canine"/"Feline".
  for (const [key, tokens] of Object.entries(SPECIES_TOKENS)) {
    if (tokens.includes(name)) return key;
  }
  return null;
}

/** Which species, if any, a service name calls out. Empty means "applies to all". */
export function speciesNamedBy(serviceName?: string | null): string[] {
  if (!serviceName) return [];
  const name = serviceName.toLowerCase();

  return Object.entries(SPECIES_TOKENS)
    .filter(([, tokens]) =>
      // Word-boundary matched so "rabies" does not read as "rabbit" and
      // "cattle" does not read as "cat".
      tokens.some((t) => new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i').test(name))
    )
    .map(([key]) => key);
}

/**
 * True when this service should be offered for a pet of this species.
 * Unknown species, or a service naming none, always returns true.
 */
export function serviceMatchesSpecies(
  serviceName?: string | null,
  speciesName?: string | null
): boolean {
  const named = speciesNamedBy(serviceName);
  if (named.length === 0) return true;

  const key = speciesKey(speciesName);
  if (!key) return true;

  return named.includes(key);
}
