export const PICKABLE_KINDS = [
  "attractions",
  "restaurants",
  "cafes",
  "bars",
] as const;

export type PickableKind = (typeof PICKABLE_KINDS)[number];

export const PLURAL_TO_PIN: Record<
  PickableKind,
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
};

export const KIND_DOT: Record<PickableKind, string> = {
  attractions: "#c9a961",
  restaurants: "#d97757",
  cafes: "#8b6f47",
  bars: "#7a4b8a",
};
