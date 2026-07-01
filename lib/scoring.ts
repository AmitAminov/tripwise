/**
 * Destination scoring per the spec:
 *
 *   destination_score =
 *     preference_match
 *   + budget_fit
 *   + flight_convenience
 *   + event_relevance
 *   + weather_fit
 *   + logistics_fit
 *   + uniqueness
 *   - visa_friction
 *   - safety_risk
 *   - travel_fatigue
 *
 * Every component is normalized to a signed contribution roughly in
 * [-10, +10] so the final total is human-interpretable.
 * When a live provider fills in real data (flight prices, events),
 * the corresponding component becomes far more confident but the
 * shape of the score stays the same.
 */

import type { DestinationCard } from "@/data/destinations";
import type { TripIntent } from "@/lib/types/trip-intent";

export interface ScoreBreakdown {
  preferenceMatch: number;
  budgetFit: number;
  flightConvenience: number;
  eventRelevance: number;
  weatherFit: number;
  logisticsFit: number;
  uniqueness: number;
  visaFriction: number;
  safetyRisk: number;
  travelFatigue: number;
  total: number;
}

export interface RankedDestination {
  destination: DestinationCard;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  concerns: string[];
}

function preferenceMatchScore(
  d: DestinationCard,
  intent: TripIntent,
): { value: number; matched: string[] } {
  const wanted = new Set(intent.preferences.interests);
  const matched = d.interestSignals.filter((s) => wanted.has(s as never));
  const denom = Math.max(1, intent.preferences.interests.length);
  return { value: (matched.length / denom) * 10, matched };
}

function budgetFitScore(
  d: DestinationCard,
  intent: TripIntent,
): { value: number; note: string | null } {
  const perPerson = intent.budget.perPerson ?? intent.budget.total;
  if (!perPerson) return { value: 0, note: null };
  const budgetTotal = perPerson * Math.max(1, intent.travelers.adults);
  const expected = d.totalEstimate.expected;
  const ratio = expected / budgetTotal;
  // ratio 1 = perfect. <1 = under-budget (good). >1 = over budget (bad).
  if (ratio <= 0.7)
    return { value: 8, note: `Well under budget (${Math.round(ratio * 100)}%)` };
  if (ratio <= 1.0)
    return { value: 6, note: `Comfortable fit (${Math.round(ratio * 100)}%)` };
  if (ratio <= 1.15)
    return { value: 2, note: `Slight stretch (${Math.round(ratio * 100)}%)` };
  if (ratio <= 1.35)
    return { value: -4, note: `Over budget (${Math.round(ratio * 100)}%)` };
  return { value: -8, note: `Well over budget (${Math.round(ratio * 100)}%)` };
}

function flightConvenienceScore(d: DestinationCard, intent: TripIntent): number {
  let score = d.flightFromTLV.directAvailable ? 6 : 2;
  if (
    intent.constraints.directFlightsOnly &&
    !d.flightFromTLV.directAvailable
  ) {
    score -= 5;
  }
  if (
    intent.constraints.maxFlightDurationHours &&
    d.flightFromTLV.typicalDurationHours >
      intent.constraints.maxFlightDurationHours
  ) {
    score -= 3;
  }
  return score;
}

function weatherFitScore(d: DestinationCard, intent: TripIntent): number {
  // Neutral baseline; couple's default is temperate. Extreme heat or cold penalized.
  const avg = (d.climate.tempMinC + d.climate.tempMaxC) / 2;
  let s = 6;
  if (avg > 30) s -= 3;
  if (avg < 10) s -= 3;
  if (d.climate.rainDaysExpected > 10) s -= 2;
  if (intent.preferences.interests.includes("beaches") && avg < 22) s -= 2;
  if (intent.preferences.interests.includes("hiking") && avg > 28) s -= 2;
  return s;
}

function logisticsFitScore(d: DestinationCard): number {
  // Placeholder: full route-optimization comes with Google Routes.
  return d.flightFromTLV.directAvailable ? 6 : 4;
}

function uniquenessScore(d: DestinationCard): number {
  // Placeholder: proxy by distinctness of interest signals.
  return Math.min(6, d.interestSignals.length);
}

function eventRelevanceScore(): number {
  // Placeholder — wires to Ticketmaster/PredictHQ when APIs land.
  return 3;
}

function visaFrictionScore(d: DestinationCard): number {
  switch (d.visa.forIsraeliPassport) {
    case "visa_free":
      return 0;
    case "visa_on_arrival":
      return -1;
    case "e_visa":
      return -2;
    case "consular_required":
      return -6;
    default:
      return -1;
  }
}

function safetyRiskScore(d: DestinationCard): number {
  switch (d.safety.level) {
    case "very_safe":
      return 0;
    case "safe":
      return -0.5;
    case "moderate":
      return -2;
    case "caution":
      return -5;
    default:
      return -1;
  }
}

function travelFatigueScore(d: DestinationCard): number {
  const h = d.flightFromTLV.typicalDurationHours;
  if (h <= 4) return 0;
  if (h <= 7) return -1;
  if (h <= 11) return -3;
  return -5;
}

export function scoreDestination(
  d: DestinationCard,
  intent: TripIntent,
): RankedDestination {
  const pref = preferenceMatchScore(d, intent);
  const budget = budgetFitScore(d, intent);
  const flight = flightConvenienceScore(d, intent);
  const weather = weatherFitScore(d, intent);
  const logistics = logisticsFitScore(d);
  const uniqueness = uniquenessScore(d);
  const events = eventRelevanceScore();
  const visa = visaFrictionScore(d);
  const safety = safetyRiskScore(d);
  const fatigue = travelFatigueScore(d);

  const breakdown: ScoreBreakdown = {
    preferenceMatch: pref.value,
    budgetFit: budget.value,
    flightConvenience: flight,
    eventRelevance: events,
    weatherFit: weather,
    logisticsFit: logistics,
    uniqueness,
    visaFriction: visa,
    safetyRisk: safety,
    travelFatigue: fatigue,
    total: 0,
  };
  breakdown.total = Object.entries(breakdown)
    .filter(([k]) => k !== "total")
    .reduce((sum, [, v]) => sum + (v as number), 0);

  const reasons: string[] = [];
  const concerns: string[] = [];

  if (pref.matched.length >= 3)
    reasons.push(`Hits ${pref.matched.length} of your interests`);
  if (budget.note && budget.value >= 4) reasons.push(budget.note);
  if (d.flightFromTLV.directAvailable) reasons.push("Direct flight from TLV");
  if (d.visa.forIsraeliPassport === "visa_free")
    reasons.push("Visa-free for Israeli passports");
  if (d.safety.level === "very_safe" || d.safety.level === "safe")
    reasons.push("Low safety concern");

  if (budget.note && budget.value < 0) concerns.push(budget.note);
  if (d.climate.rainDaysExpected >= 10)
    concerns.push("Some rainy days expected");
  if (fatigue <= -3) concerns.push("Long haul from TLV");
  if (d.safety.level === "moderate" || d.safety.level === "caution")
    concerns.push("Elevated safety consideration");

  return {
    destination: d,
    score: breakdown.total,
    breakdown,
    reasons,
    concerns,
  };
}

export function rankDestinations(
  destinations: DestinationCard[],
  intent: TripIntent,
): RankedDestination[] {
  return destinations
    .map((d) => scoreDestination(d, intent))
    .sort((a, b) => b.score - a.score);
}

export function decodeIntent(encoded: string | null): TripIntent | null {
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json) as TripIntent;
  } catch {
    return null;
  }
}
