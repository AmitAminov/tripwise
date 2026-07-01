/**
 * Data model for a user's trip intent. Populated by the adaptive survey,
 * consumed by DestinationRankingService and downstream services.
 *
 * Mirrors the spec in the design doc but keeps only the fields we use
 * today; add fields when a service actually reads them.
 */

export type PlanningDepth = "plan_now" | "intermediate" | "deep_research";

export type DateMode =
  | "exact_dates"
  | "date_range"
  | "flexible_month"
  | "duration_only";

export type GroupType =
  | "solo"
  | "couple"
  | "family"
  | "friends"
  | "business_leisure";

export type Pace = "relaxed" | "balanced" | "packed";

export type ComfortLevel = "budget" | "standard" | "premium" | "luxury";

export type BudgetStrictness = "strict" | "balanced" | "flexible";

export type Tolerance = "low" | "medium" | "high";

export const INTEREST_OPTIONS = [
  "food",
  "museums",
  "beaches",
  "hiking",
  "nightlife",
  "shopping",
  "culture",
  "history",
  "sports",
  "family_activities",
  "nature",
  "photography",
  "wellness",
  "architecture",
] as const;

export type Interest = (typeof INTEREST_OPTIONS)[number];

export interface Travelers {
  adults: number;
  children: number;
  seniors: number;
  groupType: GroupType;
}

export interface Budget {
  total?: number;
  perPerson?: number;
  strictness: BudgetStrictness;
  comfortLevel: ComfortLevel;
}

export interface Preferences {
  interests: Interest[];
  pace: Pace;
  hiddenGems: boolean;
  iconicLandmarks: boolean;
  familyFriendly: boolean;
}

export interface Constraints {
  mobility?: string;
  dietary?: string[];
  avoidLongWalks?: boolean;
  avoidDriving?: boolean;
  maxFlightDurationHours?: number;
  directFlightsOnly?: boolean;
  visaComplexityTolerance: Tolerance;
  safetyRiskTolerance: Tolerance;
}

export interface TripIntent {
  planningDepth: PlanningDepth;
  originCountry: string;
  residenceCountry?: string;
  passportCountries?: string[];
  originCity: string;
  homeAirport?: string;
  preferredCurrency: string;
  preferredLanguage: string;
  dateMode: DateMode;
  startDate?: string; // ISO YYYY-MM-DD
  endDate?: string; // ISO YYYY-MM-DD
  durationDays?: number;
  travelers: Travelers;
  budget: Budget;
  preferences: Preferences;
  constraints: Constraints;
  mustHave?: string[];
  avoid?: string[];
  /** Optional pinned candidate destinations (e.g. Bangkok, Prague, South Italy) */
  candidateDestinations?: string[];
}

export interface PriceEstimate {
  component: string;
  min: number;
  expected: number;
  max: number;
  currency: string;
  confidence: "low" | "medium" | "high";
  status: "estimated" | "live_checked" | "confirmed";
  source: string;
  checkedAt: string; // ISO timestamp
  bookingUrl?: string;
}

export function defaultTripIntent(
  depth: PlanningDepth = "plan_now",
): TripIntent {
  return {
    planningDepth: depth,
    originCountry: "IL",
    originCity: "Tel Aviv",
    homeAirport: "TLV",
    preferredCurrency: "USD",
    preferredLanguage: "en",
    dateMode: "date_range",
    travelers: {
      adults: 2,
      children: 0,
      seniors: 0,
      groupType: "couple",
    },
    budget: {
      strictness: "balanced",
      comfortLevel: "standard",
    },
    preferences: {
      interests: [],
      pace: "balanced",
      hiddenGems: true,
      iconicLandmarks: true,
      familyFriendly: false,
    },
    constraints: {
      visaComplexityTolerance: "medium",
      safetyRiskTolerance: "medium",
    },
  };
}
