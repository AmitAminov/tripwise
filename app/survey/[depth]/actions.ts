"use server";

import { redirect } from "next/navigation";
import {
  defaultTripIntent,
  INTEREST_OPTIONS,
  type ComfortLevel,
  type Interest,
  type Pace,
  type TripIntent,
} from "@/lib/types/trip-intent";

function toInterests(values: string[]): Interest[] {
  const set = new Set(INTEREST_OPTIONS as readonly string[]);
  return values.filter((v): v is Interest => set.has(v));
}

function encodeIntent(intent: TripIntent): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

export async function submitPlanNow(formData: FormData): Promise<void> {
  const intent = defaultTripIntent("plan_now");

  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  if (startDate) intent.startDate = startDate;
  if (endDate) intent.endDate = endDate;
  intent.dateMode =
    startDate && endDate ? "exact_dates" : "flexible_month";

  intent.travelers.adults = Math.max(
    1,
    Math.min(10, Number(formData.get("adults") ?? 2)),
  );
  intent.travelers.children = Math.max(
    0,
    Math.min(10, Number(formData.get("children") ?? 0)),
  );

  const perPerson = Number(formData.get("budget_per_person") ?? 0);
  if (perPerson > 0) intent.budget.perPerson = perPerson;

  const comfort = String(formData.get("comfort") ?? "standard");
  if (
    comfort === "budget" ||
    comfort === "standard" ||
    comfort === "premium" ||
    comfort === "luxury"
  ) {
    intent.budget.comfortLevel = comfort as ComfortLevel;
  }

  const pace = String(formData.get("pace") ?? "balanced");
  if (pace === "relaxed" || pace === "balanced" || pace === "packed") {
    intent.preferences.pace = pace as Pace;
  }

  intent.preferences.interests = toInterests(
    formData.getAll("interests").map((v) => String(v)),
  );

  const candidates = formData.getAll("candidates").map((v) => String(v));
  if (candidates.length > 0) intent.candidateDestinations = candidates;

  redirect(`/compare?intent=${encodeIntent(intent)}`);
}
