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

export interface RegionalHint {
  regional: boolean;
  regionQuery?: string;
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
  if (idLower.endsWith("_wide")) {
    return {
      regional: true,
      regionQuery: destinationText || prettifyId(idLower),
    };
  }
  if (REGIONAL_ID_PREFIXES.some((p) => idLower === p || idLower.startsWith(p + "_"))) {
    return { regional: true, regionQuery: destinationText || prettifyId(idLower) };
  }
  const text = (destinationText ?? "").trim().toLowerCase();
  if (!text) return { regional: false };
  if (REGION_HINTS.some((h) => text.includes(h))) {
    return { regional: true, regionQuery: destinationText ?? undefined };
  }
  if (COUNTRY_HINTS.some((h) => text === h || text.startsWith(h + ","))) {
    return { regional: true, regionQuery: destinationText ?? undefined };
  }
  return { regional: false };
}

function prettifyId(id: string): string {
  return id
    .replace(/_wide$/, "")
    .split("_")
    .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}
