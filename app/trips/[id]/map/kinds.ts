export const PICKABLE_KINDS = [
  "attractions",
  "restaurants",
  "cafes",
  "bars",
  "events",
] as const;

export type PickableKind = (typeof PICKABLE_KINDS)[number];

/**
 * Attractions/restaurants/cafes/bars come from Google Places (coord-keyed).
 * Events come from the events provider (city + trip-window keyed) — they
 * still land as pins but the fetch path is different.
 */
export const PLACES_KINDS = [
  "attractions",
  "restaurants",
  "cafes",
  "bars",
] as const;
export type PlacesKind = (typeof PLACES_KINDS)[number];

export const PLURAL_TO_PIN: Record<
  PlacesKind,
  "attraction" | "restaurant" | "cafe" | "bar"
> = {
  attractions: "attraction",
  restaurants: "restaurant",
  cafes: "cafe",
  bars: "bar",
};

export const KIND_LABEL: Record<PickableKind, string> = {
  attractions: "Attractions",
  restaurants: "Restaurants",
  cafes: "Cafés",
  bars: "Bars",
  events: "Live events",
};

export const KIND_DOT: Record<PickableKind, string> = {
  attractions: "#c9a961",
  restaurants: "#d97757",
  cafes: "#8b6f47",
  bars: "#7a4b8a",
  events: "#3a5f9e",
};
