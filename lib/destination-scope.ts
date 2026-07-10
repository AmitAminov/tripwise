/**
 * Detect whether a destination refers to a region/country rather than a
 * single city, so a Places search can broaden its scope (text search over
 * the region name instead of a 50km circle around one anchor city).
 *
 * Signals we accept:
 *  - a seed id ending in `_wide` (aggregate country entries)
 *  - the hand-tuned `south_italy` id
 *  - a destination string containing region-y language ("south italy",
 *    "puglia", "amalfi coast", "sicily", "provence", "tuscany", etc.)
 *  - a bare country name ("Italy", "France", "Japan", ...)
 *
 * False positives here are cheap (bigger scope, more results). False
 * negatives cost coverage — the whole point of the user's ask.
 */

const REGIONAL_ID_PREFIXES = ["south_italy"];

const REGION_HINTS = [
  "south italy",
  "southern italy",
  "north italy",
  "northern italy",
  "central italy",
  "amalfi",
  "amalfi coast",
  "puglia",
  "sicily",
  "sardinia",
  "tuscany",
  "provence",
  "loire",
  "brittany",
  "andalusia",
  "catalonia",
  "bavaria",
  "highlands",
  "cotswolds",
  "kansai",
  "hokkaido",
  "kyushu",
  "yucatan",
  "patagonia",
];

const COUNTRY_HINTS = [
  "italy",
  "france",
  "spain",
  "portugal",
  "germany",
  "netherlands",
  "united kingdom",
  "greece",
  "austria",
  "switzerland",
  "denmark",
  "sweden",
  "norway",
  "japan",
  "thailand",
  "vietnam",
  "indonesia",
  "india",
  "china",
  "brazil",
  "argentina",
  "mexico",
  "united states",
  "canada",
  "australia",
  "new zealand",
];

export type Direction = "north" | "south" | "east" | "west";

export interface RegionalHint {
  regional: boolean;
  regionQuery?: string;
  /**
   * When the destination text carries a cardinal-direction word
   * ("south italy", "northern france", "east japan", "western spain"),
   * the caller can use this together with the country's centroid to
   * hard-filter results to the correct half of the country. Country-
   * wide entries (`italy_wide`) intentionally omit this.
   */
  direction?: Direction;
}

// Regex captures either "south italy" / "southern italy" / "south of italy"
// as well as the reverse phrasing "italy south". Country name is
// whatever comes after the direction (or before, in the second case).
const DIRECTION_RE = /(?:^|\s)(north|northern|south|southern|east|eastern|west|western)(?:\s+of)?\s+([a-z][a-z\s]*)/i;

function normalizeDirection(word: string): Direction {
  const w = word.toLowerCase();
  if (w.startsWith("north")) return "north";
  if (w.startsWith("south")) return "south";
  if (w.startsWith("east")) return "east";
  return "west";
}

/**
 * @param id  A destination seed id (`south_italy`, `italy_wide`, `paris`)
 * @param destinationText  Free-text destination name shown on a real
 *   user trip (`"South Italy"`, `"Amalfi Coast + Puglia"`, `"Paris"`)
 */
export function detectRegionalScope(
  id: string | null | undefined,
  destinationText: string | null | undefined,
): RegionalHint {
  const idLower = (id ?? "").toLowerCase();

  // Extract direction from either the id (`south_italy`) or the free
  // text (`"South Italy"` / `"Northern France"`). Applied to every
  // return path so a country-wide + directional trip still gets it.
  let direction: Direction | undefined;
  if (idLower.startsWith("south_")) direction = "south";
  else if (idLower.startsWith("north_")) direction = "north";
  else if (idLower.startsWith("east_")) direction = "east";
  else if (idLower.startsWith("west_")) direction = "west";
  else {
    const m = (destinationText ?? "").match(DIRECTION_RE);
    if (m) direction = normalizeDirection(m[1]);
  }

  if (idLower.endsWith("_wide")) {
    // Country-wide entries mean "all of the country" — no direction
    // filter even if a stray "south" is somewhere in the text.
    return {
      regional: true,
      regionQuery: destinationText || prettifyId(idLower),
    };
  }
  if (REGIONAL_ID_PREFIXES.some((p) => idLower === p || idLower.startsWith(p + "_"))) {
    return {
      regional: true,
      regionQuery: destinationText || prettifyId(idLower),
      direction,
    };
  }
  const text = (destinationText ?? "").trim().toLowerCase();
  if (!text) return { regional: false };
  if (REGION_HINTS.some((h) => text.includes(h))) {
    return {
      regional: true,
      regionQuery: destinationText ?? undefined,
      direction,
    };
  }
  if (COUNTRY_HINTS.some((h) => text === h || text.startsWith(h + ","))) {
    return {
      regional: true,
      regionQuery: destinationText ?? undefined,
      direction,
    };
  }
  return { regional: false, direction };
}

function prettifyId(id: string): string {
  return id
    .replace(/_wide$/, "")
    .split("_")
    .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}
