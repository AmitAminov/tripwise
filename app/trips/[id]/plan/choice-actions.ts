"use server";

import { createClient } from "@/lib/supabase/server";
import { placesProvider, eventsProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { revalidatePath } from "next/cache";

type Slot = "morning" | "afternoon" | "evening" | "any";

/**
 * Structured day plan: instead of freeform itinerary items, a day is a
 * chunk of multiple-choice questions from a bank. Options are populated
 * from real data (Google Places for attractions/restaurants, events
 * provider for evening) so the user just picks — no typing.
 *
 * Bank: 3 questions per day.
 *   morning     — attraction to explore (Places attractions)
 *   afternoon   — lunch spot          (Places restaurants)
 *   evening     — evening plan       (events if any, else restaurants+bars)
 *
 * When the user picks an option, the decision is marked decided AND
 * the chosen option becomes an itinerary_item on the plan.
 */

interface QuestionTemplate {
  key: string;
  slot: Slot;
  category: "food" | "activity" | "other";
  title: (dayLabel: string) => string;
  fillOptions: (
    ctx: OptionCtx,
  ) => Promise<Array<{ label: string; notes?: string; url?: string }>>;
}

interface OptionCtx {
  city: string;
  coords: { lat: number; lng: number } | null;
  regional: boolean;
  regionQuery?: string;
  countryFilter?: string;
  dayStartIso: string;
  dayEndIso: string;
}

const OPTIONS_PER_QUESTION = 4;

const DAY_QUESTION_BANK: QuestionTemplate[] = [
  {
    key: "morning-attraction",
    slot: "morning",
    category: "activity",
    title: (d) => `${d} — morning: pick a spot to explore`,
    async fillOptions(ctx) {
      const provider = placesProvider();
      if (!provider || !ctx.coords) return [];
      const res = await provider.search({
        center: ctx.coords,
        kind: "attractions",
        regional: ctx.regional,
        regionQuery: ctx.regionQuery,
        countryFilter: ctx.countryFilter,
        limit: 20,
      });
      return topN(res.data ?? [], OPTIONS_PER_QUESTION).map((p) => ({
        label: p.name,
        notes: buildPlaceNote(p),
        url: p.websiteUrl,
      }));
    },
  },
  {
    key: "lunch",
    slot: "afternoon",
    category: "food",
    title: (d) => `${d} — lunch: where to eat?`,
    async fillOptions(ctx) {
      const provider = placesProvider();
      if (!provider || !ctx.coords) return [];
      const res = await provider.search({
        center: ctx.coords,
        kind: "restaurants",
        regional: ctx.regional,
        regionQuery: ctx.regionQuery,
        countryFilter: ctx.countryFilter,
        limit: 20,
      });
      return topN(res.data ?? [], OPTIONS_PER_QUESTION).map((p) => ({
        label: p.name,
        notes: buildPlaceNote(p),
        url: p.websiteUrl,
      }));
    },
  },
  {
    key: "evening",
    slot: "evening",
    category: "activity",
    title: (d) => `${d} — evening: what's the plan?`,
    async fillOptions(ctx) {
      // Prefer live events for the evening — a real concert is better
      // than a generic "top bar" pick. Fall back to bars if no events.
      const ev = eventsProvider();
      if (ev) {
        const res = await ev.search({
          city: ctx.city,
          from: ctx.dayStartIso,
          to: ctx.dayEndIso,
          limit: 10,
        });
        const withCoords = (res.data ?? []).filter((e) => e.coords);
        if (withCoords.length >= 2) {
          return withCoords.slice(0, OPTIONS_PER_QUESTION).map((e) => ({
            label: e.name,
            notes: [
              e.startAt.slice(11, 16),
              e.venueName,
              e.categories.slice(0, 2).join(", "),
            ]
              .filter(Boolean)
              .join(" · "),
            url: e.ticketUrl,
          }));
        }
      }
      // Fallback: top bars near the destination.
      const provider = placesProvider();
      if (!provider || !ctx.coords) return [];
      const res = await provider.search({
        center: ctx.coords,
        kind: "bars",
        regional: ctx.regional,
        regionQuery: ctx.regionQuery,
        countryFilter: ctx.countryFilter,
        limit: 20,
      });
      return topN(res.data ?? [], OPTIONS_PER_QUESTION).map((p) => ({
        label: p.name,
        notes: buildPlaceNote(p),
        url: p.websiteUrl,
      }));
    },
  },
];

function topN<T extends { rating?: number; ratingCount?: number }>(
  arr: T[],
  n: number,
): T[] {
  // Rank: rating × log(count + 1). Places already sorts by popularity
  // but this stabilizes ordering when the top few tie on rating.
  const scored = arr
    .filter((x) => (x as unknown as { name?: string }))
    .map((x) => {
      const r = x.rating ?? 3.5;
      const c = x.ratingCount ?? 0;
      return { x, s: r * Math.log(c + 10) };
    })
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map((v) => v.x);
}

interface PlaceLike {
  name: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;
  address?: string;
  websiteUrl?: string;
}

function buildPlaceNote(p: PlaceLike): string {
  const parts: string[] = [];
  if (p.rating != null) {
    parts.push(`${p.rating.toFixed(1)}★${p.ratingCount ? ` (${p.ratingCount.toLocaleString()})` : ""}`);
  }
  if (typeof p.priceLevel === "number" && p.priceLevel > 0) {
    parts.push("$".repeat(p.priceLevel));
  }
  if (p.address) parts.push(p.address);
  return parts.join(" · ");
}

/**
 * Populate a single day of the trip with structured MCQ decisions.
 * Skips silently when a day already has decisions from a previous run
 * (idempotent — call it twice, still one set of choices).
 */
export async function draftDayChoices(
  tripId: string,
  dayIndex: number,
): Promise<{ error?: string; created?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { error: "Trip not found." };

  // Idempotency: if this day already has any decision from the bank,
  // don't create duplicates. User can delete + redraft manually if
  // they want fresh options.
  const { data: existing } = await supabase
    .from("decisions")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex);
  if (existing && existing.length > 0) {
    return { created: 0 };
  }

  const destination = trip.destination ?? trip.name;
  const resolved = await resolveDestination(destination);
  const coords = resolved?.coords ?? null;
  const scope = detectRegionalScope(null, destination);

  const anchorMs = trip.start_date
    ? new Date(trip.start_date).getTime()
    : Date.now();
  const dayStartIso = new Date(
    anchorMs + dayIndex * 86400 * 1000,
  ).toISOString();
  const dayEndIso = new Date(
    new Date(dayStartIso).getTime() + 86400 * 1000 - 1,
  ).toISOString();

  const dayLabel = trip.start_date
    ? new Date(dayStartIso).toISOString().slice(0, 10)
    : `Day ${dayIndex + 1}`;

  const ctx: OptionCtx = {
    city: destination,
    coords,
    regional: scope.regional,
    regionQuery: scope.regionQuery,
    countryFilter: resolved?.country ?? undefined,
    dayStartIso,
    dayEndIso,
  };

  // Fill every question in parallel — Places is SWR-cached so the
  // second question about restaurants reuses whatever the first
  // fetched for attractions, and events lookup is its own network.
  const filled = await Promise.all(
    DAY_QUESTION_BANK.map(async (q) => ({
      template: q,
      options: await q.fillOptions(ctx),
    })),
  );

  let created = 0;
  for (const { template, options } of filled) {
    if (options.length < 2) continue; // no MCQ with 0 or 1 options
    const { data: decision, error: decError } = await supabase
      .from("decisions")
      .insert({
        trip_id: tripId,
        title: template.title(dayLabel).slice(0, 200),
        category: template.category,
        status: "open",
        day_index: dayIndex,
        slot: template.slot,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (decError || !decision) continue;
    const optionRows = options.map((o, i) => ({
      decision_id: decision.id,
      label: o.label.slice(0, 200),
      url: o.url ?? null,
      notes: o.notes ?? null,
      position: i,
    }));
    const { error: optError } = await supabase
      .from("options")
      .insert(optionRows);
    if (optError) continue;
    created += 1;
  }

  revalidatePath(`/trips/${tripId}/plan`);
  return { created };
}

/**
 * Trip-wide version: draft every day's MCQ set in parallel batches.
 */
export async function draftTripChoices(
  tripId: string,
): Promise<{
  error?: string;
  totalDays?: number;
  createdByDay?: Array<{ dayIndex: number; created?: number; error?: string }>;
  totalCreated?: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { error: "Trip not found." };

  const start = trip.start_date ? new Date(trip.start_date) : null;
  const end = trip.end_date ? new Date(trip.end_date) : null;
  let totalDays = 7;
  if (start && end && !Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf())) {
    const diff = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    totalDays = Math.max(1, Math.min(30, diff + 1));
  }

  const CONCURRENCY = 3;
  const results: Array<{ dayIndex: number; created?: number; error?: string }> = [];
  for (let s = 0; s < totalDays; s += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, totalDays - s) },
      (_, i) => s + i,
    );
    const batchResults = await Promise.all(
      batch.map(async (dayIndex) => {
        const res = await draftDayChoices(tripId, dayIndex);
        return { dayIndex, ...res };
      }),
    );
    results.push(...batchResults);
  }

  const totalCreated = results.reduce((s, r) => s + (r.created ?? 0), 0);
  revalidatePath(`/trips/${tripId}/plan`);
  return { totalDays, createdByDay: results, totalCreated };
}

/**
 * User picks one option per MCQ. Marks the decision decided AND
 * inserts the chosen option as an itinerary_item so the plan renders
 * it in the right day + slot alongside any freeform items.
 *
 * Idempotent: picking the same option twice is a no-op success.
 * Switching to a different option updates winning_option_id AND
 * replaces the itinerary row.
 */
export async function pickChoice(
  tripId: string,
  decisionId: string,
  optionId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: decision, error: decError } = await supabase
    .from("decisions")
    .select("id, trip_id, day_index, slot, winning_option_id")
    .eq("id", decisionId)
    .maybeSingle();
  if (decError || !decision) return { error: "Decision not found." };
  if (decision.trip_id !== tripId) return { error: "Trip mismatch." };
  if (decision.day_index == null) {
    return { error: "This decision isn't day-scoped." };
  }

  const { data: option, error: optError } = await supabase
    .from("options")
    .select("id, decision_id, label, url, notes")
    .eq("id", optionId)
    .maybeSingle();
  if (optError || !option) return { error: "Option not found." };
  if (option.decision_id !== decisionId) return { error: "Option mismatch." };

  // Same option as already-picked → no-op.
  if (decision.winning_option_id === optionId) return {};

  // Delete any previously-inserted itinerary item for this decision so
  // switching choice replaces cleanly. Store the decision id in the
  // note tag so we can find + remove the old row.
  const decisionTag = `[choice:${decisionId}]`;
  await supabase
    .from("itinerary_items")
    .delete()
    .eq("trip_id", tripId)
    .eq("day_index", decision.day_index)
    .ilike("notes", `%${decisionTag}%`);

  // Update decision → decided.
  const now = new Date().toISOString();
  const { error: updError } = await supabase
    .from("decisions")
    .update({
      status: "decided",
      winning_option_id: optionId,
      decided_at: now,
    })
    .eq("id", decisionId);
  if (updError) return { error: updError.message };

  // Insert as itinerary_item so it renders in the plan.
  const slotRaw = decision.slot ?? "any";
  const slot: Slot = (
    ["morning", "afternoon", "evening", "any"] as Slot[]
  ).includes(slotRaw as Slot)
    ? (slotRaw as Slot)
    : "any";

  const { data: existingSlot } = await supabase
    .from("itinerary_items")
    .select("position")
    .eq("trip_id", tripId)
    .eq("day_index", decision.day_index)
    .eq("slot", slot)
    .order("position", { ascending: false })
    .limit(1);
  const position = (existingSlot?.[0]?.position ?? -1) + 1;

  const noteParts: string[] = [];
  if (option.notes) noteParts.push(option.notes);
  if (option.url) noteParts.push(`Details: ${option.url}`);
  noteParts.push(decisionTag);
  const notes = noteParts.join(" · ").slice(0, 500);

  const { error: insError } = await supabase.from("itinerary_items").insert({
    trip_id: tripId,
    day_index: decision.day_index,
    slot,
    position,
    title: option.label.slice(0, 200),
    notes,
    created_by: user.id,
  });
  if (insError) return { error: insError.message };

  revalidatePath(`/trips/${tripId}/plan`);
  return {};
}
