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

/** Matches one token as a whole word, so "cattle" does not read as "cat". */
function mentions(haystack: string, token: string): boolean {
  return new RegExp(`\\b${token.replace(/\s+/g, '\\s+')}\\b`, 'i').test(haystack);
}

/** Normalises a species name from the API ("Canine", "Feline") to a token key. */
function speciesKey(speciesName?: string | null): string | null {
  if (!speciesName) return null;
  const name = speciesName.trim().toLowerCase();
  if (SPECIES_TOKENS[name]) return name;

  // Species names are free text the clinic types in, so an exact match only
  // recognises the canonical spelling. "Dog", "Dogs", "Canine (Dog)" and
  // "Feline - Cat" all have to resolve, or the filter quietly gives up and
  // every species-specific vaccine is offered for every pet again.
  for (const [key, tokens] of Object.entries(SPECIES_TOKENS)) {
    if (tokens.some((t) => mentions(name, t))) return key;
  }
  return null;
}

/** Which species, if any, a service name calls out. Empty means "applies to all". */
export function speciesNamedBy(serviceName?: string | null): string[] {
  if (!serviceName) return [];
  const name = serviceName.toLowerCase();

  return Object.entries(SPECIES_TOKENS)
    // Word-boundary matched so "rabies" does not read as "rabbit" and
    // "cattle" does not read as "cat".
    .filter(([, tokens]) => tokens.some((t) => mentions(name, t)))
    .map(([key]) => key);
}

/**
 * The species name for a pet record, whatever shape it arrives in.
 *
 * /pets serialises species as a nested { id, name } object, but the same pet
 * reaches this screen from a localStorage snapshot and from other endpoints
 * that flatten it. Reading only `pet.species.name` meant one unexpected shape
 * silently disabled the filter and every service was offered again, which is
 * indistinguishable from the filter not existing.
 */
export function petSpeciesName(pet: any): string | null {
  if (!pet) return null;
  const s = pet.species;
  if (typeof s === 'string' && s.trim()) return s;
  if (s && typeof s.name === 'string' && s.name.trim()) return s.name;
  if (typeof pet.species_name === 'string' && pet.species_name.trim()) return pet.species_name;
  return null;
}

/**
 * True when this service should be offered for a pet of this species.
 *
 * A service naming no species is always offered. One that names a species is
 * offered only when the pet is positively known to be that species — a species
 * that cannot be read counts as "not a match", because listing the dog vaccine
 * and the cat vaccine together under every pet is exactly the confusion this
 * filter exists to remove.
 */
export function serviceMatchesSpecies(
  serviceName?: string | null,
  speciesName?: string | null
): boolean {
  const named = speciesNamedBy(serviceName);
  if (named.length === 0) return true;

  const key = speciesKey(speciesName);
  if (!key) return false;

  return named.includes(key);
}
