"use server";

import { redirect } from "next/navigation";
import {
  defaultTripIntent,
  INTEREST_OPTIONS,
  type ComfortLevel,
  type GroupType,
  type Interest,
  type Pace,
  type Tolerance,
  type TripIntent,
} from "@/lib/types/trip-intent";

function toInterests(values: string[]): Interest[] {
  const set = new Set(INTEREST_OPTIONS as readonly string[]);
  return values.filter((v): v is Interest => set.has(v));
}

function safeNumber(v: FormDataEntryValue | null, dflt: number): number {
  const n = Number(v ?? dflt);
  return Number.isFinite(n) ? n : dflt;
}

function readString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function readList(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter(Boolean);
}

function encodeIntent(intent: TripIntent): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

const TOLERANCES: readonly Tolerance[] = ["low", "medium", "high"];
function asTolerance(v: string | undefined): Tolerance | undefined {
  return v && (TOLERANCES as readonly string[]).includes(v)
    ? (v as Tolerance)
    : undefined;
}

const GROUPS: readonly GroupType[] = [
  "solo",
  "couple",
  "family",
  "friends",
  "business_leisure",
];
function asGroup(v: string | undefined): GroupType | undefined {
  return v && (GROUPS as readonly string[]).includes(v)
    ? (v as GroupType)
    : undefined;
}

export async function submitPlanNow(formData: FormData): Promise<void> {
  const intent = defaultTripIntent("plan_now");

  // Origin
  intent.originCity =
    readString(formData, "origin_city") ?? intent.originCity;
  intent.homeAirport =
    readString(formData, "home_airport") ?? intent.homeAirport;

  // Dates — either exact_dates (start_date + end_date) or a flexible window
  // (window_start + window_end + duration_nights). The UI toggles between modes.
  const dateModeInput = readString(formData, "date_mode");
  const flexible = dateModeInput === "flexible_month";
  const windowStart = readString(formData, "window_start");
  const windowEnd = readString(formData, "window_end");
  const durationNights = safeNumber(formData.get("duration_nights"), 0);
  const startDate = readString(formData, "start_date");
  const endDate = readString(formData, "end_date");

  if (flexible && windowStart && windowEnd) {
    intent.windowStart = windowStart;
    intent.windowEnd = windowEnd;
    if (durationNights > 0) intent.durationDays = durationNights;
    // Default a concrete slice at the window start so downstream code that
    // wants a single trip week can proceed.
    intent.startDate = windowStart;
    if (durationNights > 0) {
      const d = new Date(windowStart);
      d.setUTCDate(d.getUTCDate() + durationNights);
      intent.endDate = d.toISOString().slice(0, 10);
    }
    intent.dateMode = "flexible_month";
  } else {
    if (startDate) intent.startDate = startDate;
    if (endDate) intent.endDate = endDate;
    intent.dateMode = startDate && endDate ? "exact_dates" : "flexible_month";
  }

  // Travelers
  intent.travelers.adults = Math.max(
    1,
    Math.min(10, safeNumber(formData.get("adults"), 2)),
  );
  intent.travelers.children = Math.max(
    0,
    Math.min(10, safeNumber(formData.get("children"), 0)),
  );
  intent.travelers.seniors = Math.max(
    0,
    Math.min(10, safeNumber(formData.get("seniors"), 0)),
  );
  const group = asGroup(readString(formData, "group_type"));
  if (group) intent.travelers.groupType = group;

  // Budget — single value OR a range. When range is present, perPerson defaults
  // to the midpoint so downstream scoring/ranking still has a point estimate.
  const perPerson = safeNumber(formData.get("budget_per_person"), 0);
  const perPersonMin = safeNumber(formData.get("budget_per_person_min"), 0);
  const perPersonMax = safeNumber(formData.get("budget_per_person_max"), 0);
  if (perPersonMin > 0 && perPersonMax > 0 && perPersonMax >= perPersonMin) {
    intent.budget.perPersonMin = perPersonMin;
    intent.budget.perPersonMax = perPersonMax;
    intent.budget.perPerson = Math.round((perPersonMin + perPersonMax) / 2);
  } else if (perPerson > 0) {
    intent.budget.perPerson = perPerson;
  }
  const comfort = readString(formData, "comfort");
  if (comfort === "budget" || comfort === "standard" || comfort === "premium" || comfort === "luxury") {
    intent.budget.comfortLevel = comfort as ComfortLevel;
  }

  // Preferences
  const pace = readString(formData, "pace");
  if (pace === "relaxed" || pace === "balanced" || pace === "packed") {
    intent.preferences.pace = pace as Pace;
  }
  intent.preferences.interests = toInterests(readList(formData, "interests"));
  intent.preferences.hiddenGems = formData.get("hidden_gems") === "true";
  intent.preferences.iconicLandmarks =
    formData.get("iconic_landmarks") === "true";
  intent.preferences.familyFriendly = intent.travelers.children > 0;

  // Constraints
  if (formData.get("direct_only") === "true") {
    intent.constraints.directFlightsOnly = true;
  }
  const maxFlight = safeNumber(formData.get("max_flight_duration_hours"), 0);
  if (maxFlight > 0) intent.constraints.maxFlightDurationHours = maxFlight;
  if (formData.get("avoid_long_walks") === "true") {
    intent.constraints.avoidLongWalks = true;
  }
  if (formData.get("avoid_driving") === "true") {
    intent.constraints.avoidDriving = true;
  }
  const visa = asTolerance(readString(formData, "visa_tolerance"));
  if (visa) intent.constraints.visaComplexityTolerance = visa;
  const safety = asTolerance(readString(formData, "safety_tolerance"));
  if (safety) intent.constraints.safetyRiskTolerance = safety;
  const dietary = readList(formData, "dietary");
  if (dietary.length > 0) intent.constraints.dietary = dietary;
  const mobility = readString(formData, "mobility");
  if (mobility) intent.constraints.mobility = mobility;

  // Freeform
  const mustHaveRaw = readString(formData, "must_have");
  if (mustHaveRaw) {
    intent.mustHave = mustHaveRaw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const avoidRaw = readString(formData, "avoid");
  if (avoidRaw) {
    intent.avoid = avoidRaw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const candidates = readList(formData, "candidates");
  if (candidates.length > 0) intent.candidateDestinations = candidates;

  // Planning depth reflects the source form (survey/[depth]/page delegates).
  const declared = readString(formData, "planning_depth");
  if (
    declared === "plan_now" ||
    declared === "intermediate" ||
    declared === "deep_research"
  ) {
    intent.planningDepth = declared;
  }

  redirect(`/compare?intent=${encodeIntent(intent)}`);
}
