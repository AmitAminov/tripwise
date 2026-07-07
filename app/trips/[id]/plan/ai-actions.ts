"use server";

import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/gemini";
import { placesProvider, eventsProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { geocode } from "@/lib/geocoding";
import type { EventItem } from "@/lib/providers/types";
import { revalidatePath } from "next/cache";

/**
 * Ask Gemini for a 3-4-item draft for a specific day of the trip, then
 * insert the items straight into itinerary_items. Callers refresh the
 * page and the new items appear in the day card.
 *
 * We ask for JSON output via a structured responseSchema so the model
 * doesn't wrap it in markdown. Failures come back as { error }; nothing
 * gets partially inserted.
 */

type Slot = "morning" | "afternoon" | "evening" | "any";

interface DraftItem {
  title: string;
  slot: Slot;
  notes?: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          slot: {
            type: "string",
            enum: ["morning", "afternoon", "evening", "any"],
          },
          notes: { type: "string" },
        },
        required: ["title", "slot"],
      },
    },
  },
  required: ["items"],
};

function isSlot(v: string): v is Slot {
  return ["morning", "afternoon", "evening", "any"].includes(v);
}

export async function draftDayPlan(
  tripId: string,
  dayIndex: number,
): Promise<{ error?: string; added?: number }> {
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

  // What's already on the plan for this day? Avoid duplicates.
  const { data: existingDay } = await supabase
    .from("itinerary_items")
    .select("title, slot")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex);

  // Any decided options from the decision arena? Surface them so the
  // model doesn't recommend something the couple already picked.
  const { data: decidedOptions } = await supabase
    .from("decisions")
    .select("title, winning_option_id, options!inner(id, label)")
    .eq("trip_id", tripId)
    .eq("status", "decided");

  const dateStr = trip.start_date
    ? new Date(
        new Date(trip.start_date).getTime() + dayIndex * 86400 * 1000,
      )
        .toISOString()
        .slice(0, 10)
    : `Day ${dayIndex + 1} of trip`;

  const destination = trip.destination ?? trip.name;

  // Resolve destination coordinates — seed data first, then Geocoding
  // for any other city.
  const resolved = await resolveDestination(destination);
  const coords = resolved?.coords ?? null;

  // Pull real Places data (top attractions + restaurants) AND real events
  // happening on THIS day, all in parallel, so the prompt sees both.
  // Events use the trip's city name + a 24h window centered on this day.
  const provider = placesProvider();
  const eProvider = eventsProvider();

  // Day window: from the day's date at 00:00 UTC to 23:59 UTC.
  // We use UTC on purpose — the events API accepts ISO instants and we don't
  // want a locale swing to move the query off the day. When the trip has no
  // start_date we anchor on today, but we STILL add `dayIndex` days so
  // "Day 3" of a date-less trip means three days from now, not today —
  // otherwise the events query silently collapses to today for every day.
  const anchorMs = trip.start_date
    ? new Date(trip.start_date).getTime()
    : Date.now();
  const dayStartIso = new Date(
    anchorMs + dayIndex * 86400 * 1000,
  ).toISOString();
  const dayEndIso = new Date(
    new Date(dayStartIso).getTime() + 86400 * 1000 - 1,
  ).toISOString();

  const eventsCity = destination;

  const scope = detectRegionalScope(null, destination);

  const [attractionsRes, restaurantsRes, eventsRes] = await Promise.all([
    provider && coords
      ? provider.search({
          center: coords,
          kind: "attractions",
          regional: scope.regional,
          regionQuery: scope.regionQuery,
          countryFilter: resolved?.country ?? undefined,
          limit: 20,
        })
      : Promise.resolve(null),
    provider && coords
      ? provider.search({
          center: coords,
          kind: "restaurants",
          regional: scope.regional,
          regionQuery: scope.regionQuery,
          countryFilter: resolved?.country ?? undefined,
          limit: 20,
        })
      : Promise.resolve(null),
    eProvider
      ? eProvider.search({
          city: eventsCity,
          from: dayStartIso,
          to: dayEndIso,
          limit: 8,
        })
      : Promise.resolve(null),
  ]);

  const placeLines: string[] = [];
  for (const p of attractionsRes?.data ?? []) {
    const rating = p.rating ? ` [${p.rating.toFixed(1)}★]` : "";
    placeLines.push(`- ${p.name}${rating} (attraction)`);
  }
  for (const p of restaurantsRes?.data ?? []) {
    const rating = p.rating ? ` [${p.rating.toFixed(1)}★]` : "";
    placeLines.push(`- ${p.name}${rating} (restaurant)`);
  }

  // Event lines + a lookup so we can preserve venue coords + ticket URLs when
  // Gemini picks one by exact name.
  const events: EventItem[] = eventsRes?.data ?? [];
  const eventByLowerName = new Map<string, EventItem>();
  const eventLines: string[] = [];
  for (const ev of events) {
    const start = ev.startAt.slice(11, 16); // HH:MM
    const venue = ev.venueName ? ` at ${ev.venueName}` : "";
    const cat =
      ev.categories.length > 0 ? ` [${ev.categories.slice(0, 2).join(", ")}]` : "";
    eventLines.push(`- ${ev.name}${venue}, starts ${start}${cat}`);
    eventByLowerName.set(ev.name.toLowerCase(), ev);
  }

  const existingLines = (existingDay ?? [])
    .map((e) => `- ${e.slot}: ${e.title}`)
    .join("\n");
  const decidedLines = (decidedOptions ?? [])
    .map((d) => {
      const opt = Array.isArray(d.options) ? d.options[0] : d.options;
      return opt ? `- ${d.title}: ${opt.label}` : `- ${d.title}`;
    })
    .join("\n");

  const prompt = `You are helping a couple plan one day of their trip. Draft a realistic Day ${
    dayIndex + 1
  } for them in **${destination}** on **${dateStr}**.

Rules:
- 3 to 4 items total, distributed across morning, afternoon, and evening
- Each item is one specific concrete thing (not "explore old town" — pick a specific attraction, restaurant, walk, or moment)
- ${placeLines.length > 0 ? "STRONGLY prefer places from the 'Real places nearby' list below. Use their exact names." : "Use well-known specific places."}
- ${eventLines.length > 0 ? "If a 'Real events happening on this date' entry fits the vibe (concert, festival, exhibit, show), include it — use the EXACT event name as the item title so we can link tickets. Prefer an event for evening when one exists." : ""}
- Consider walking distance and jet-lag on the first day
- Weather-appropriate for the destination and date
- Reflect that the travelers are a couple, not a group tour
- Do NOT recommend anything already on their existing plan
- Prefer items that fit with their already-decided choices${
    decidedLines ? " (listed below)" : ""
  }
- Notes are one short sentence — a booking hint, a timing tip, or why this over the obvious pick

Real places nearby (rated on Google Maps — prefer these):
${placeLines.join("\n") || "(none — Places API not available; use general knowledge)"}

Real events happening on this date (from PredictHQ / Ticketmaster — use the exact event name so tickets link correctly):
${eventLines.join("\n") || "(no live events matched this date)"}

Existing items on this day (skip these):
${existingLines || "(none yet)"}

Already-decided choices for the trip (fit around these):
${decidedLines || "(none yet)"}

Return JSON matching the schema.`;

  const result = await generateText({
    prompt,
    model: "gemini-2.5-flash",
    maxOutputTokens: 900,
    temperature: 0.85,
    responseSchema: RESPONSE_SCHEMA,
  });

  if (!result.ok) {
    return { error: `Gemini: ${result.error}` };
  }

  let parsed: { items: DraftItem[] };
  try {
    parsed = JSON.parse(result.text) as { items: DraftItem[] };
  } catch {
    return { error: "Model returned invalid JSON." };
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return { error: "Model returned no items." };
  }

  // Insert each item with a slot-scoped position.
  const positionsBySlot = new Map<Slot, number>();
  for (const slot of ["morning", "afternoon", "evening", "any"] as Slot[]) {
    const { data: rows } = await supabase
      .from("itinerary_items")
      .select("position")
      .eq("trip_id", tripId)
      .eq("day_index", dayIndex)
      .eq("slot", slot)
      .order("position", { ascending: false })
      .limit(1);
    positionsBySlot.set(slot, (rows?.[0]?.position ?? -1) + 1);
  }

  // For each draft item:
  //   - If it matches a real event by exact name, use the event's venue
  //     coords + venue name + ticket URL (no geocoding call needed).
  //   - Otherwise, geocode the title within the destination context so
  //     Routes can compute walking-time chips between stops.
  // Runs the geocoding lookups in parallel (they're cached in-memory).
  //
  // Two dedupe / validity filters before we hit the DB:
  //   1. Trim + reject whitespace-only titles. The DB has
  //      `check (length(title) between 1 and 200)` so an insert with a
  //      blank title would fail the whole batch. `it.title` truthy-check
  //      alone accepts "   " which passes JS but fails Postgres.
  //   2. Skip anything already on this day (case-insensitive title
  //      match). We tell Gemini to skip existing items in the prompt,
  //      but the model doesn't always obey — clicking "AI draft" twice
  //      on the same day would otherwise produce duplicates.
  const existingLower = new Set(
    (existingDay ?? []).map((e) => (e.title ?? "").trim().toLowerCase()),
  );
  const seenThisBatch = new Set<string>();
  const drafts = parsed.items.filter((it) => {
    if (!it.title || !isSlot(it.slot)) return false;
    const trimmed = it.title.trim();
    if (trimmed.length === 0) return false;
    const key = trimmed.toLowerCase();
    if (existingLower.has(key)) return false;
    if (seenThisBatch.has(key)) return false;
    seenThisBatch.add(key);
    it.title = trimmed;
    return true;
  });
  const matchedEvents: (EventItem | null)[] = drafts.map(
    (it) => eventByLowerName.get(it.title.toLowerCase()) ?? null,
  );
  const geocoded = await Promise.all(
    drafts.map((it, i) =>
      matchedEvents[i]
        ? Promise.resolve(null) // event supplies coords/address
        : geocode(`${it.title}, ${destination}`).catch(() => null),
    ),
  );

  const inserts = drafts.map((it, i) => {
    const slot = it.slot as Slot;
    const pos = positionsBySlot.get(slot) ?? 0;
    positionsBySlot.set(slot, pos + 1);

    // Tag AI-drafted notes with provenance. When the draft matches a real
    // event, also fold in the ticket URL + start time so the user can act
    // on it without leaving the plan.
    const rawNotes = it.notes?.slice(0, 260) ?? "";
    const ev = matchedEvents[i];
    const eventSuffix = ev
      ? ` · Starts ${ev.startAt.slice(11, 16)}${ev.ticketUrl ? " · Tickets: " + ev.ticketUrl : ""} · [Live event]`
      : " · [AI draft]";
    const notes = rawNotes
      ? `${rawNotes}${eventSuffix}`
      : eventSuffix.replace(/^ · /, "");

    // Prefer event venue data when we matched one; fall back to geocoding.
    const geoHit = geocoded[i];
    const address = ev?.venueName ?? geoHit?.formattedAddress ?? null;
    const coordsLat = ev?.coords?.lat ?? geoHit?.coords.lat ?? null;
    const coordsLng = ev?.coords?.lng ?? geoHit?.coords.lng ?? null;

    return {
      trip_id: tripId,
      day_index: dayIndex,
      slot,
      position: pos,
      title: it.title.slice(0, 200),
      notes,
      address,
      coords_lat: coordsLat,
      coords_lng: coordsLng,
      created_by: user.id,
    };
  });

  if (inserts.length === 0) return { error: "No valid items to insert." };

  const { error } = await supabase.from("itinerary_items").insert(inserts);
  if (error) return { error: error.message };

  revalidatePath(`/trips/${tripId}/plan`);
  return { added: inserts.length };
}

/**
 * Draft EVERY day of the trip in a single click. Fires `draftDayPlan`
 * for each day in parallel (bounded concurrency so we don't fan out
 * dozens of Places + Events + Gemini calls at once and blow provider
 * quotas). Returns aggregate counts + a per-day breakdown so the UI
 * can render "3/7 days drafted, 4 skipped (already populated)".
 */
export async function draftAllDaysPlan(
  tripId: string,
): Promise<{
  error?: string;
  totalDays?: number;
  addedByDay?: Array<{ dayIndex: number; added?: number; error?: string }>;
  totalAdded?: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: trip } = await supabase
    .from("trips")
    .select("id, start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { error: "Trip not found." };

  // Same day-count math the plan page uses. Cap at 30 as a safety
  // rail — no one drafts 60 days at once, and Gemini + Places both
  // start pushing back well before that.
  const start = trip.start_date ? new Date(trip.start_date) : null;
  const end = trip.end_date ? new Date(trip.end_date) : null;
  let totalDays = 7;
  if (start && end && !Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf())) {
    const diff = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    totalDays = Math.max(1, Math.min(30, diff + 1));
  }

  // Bounded concurrency: 3 parallel drafts is a reasonable middle
  // ground between "fire them all and hope" and "one at a time and
  // wait forever". Places / events providers are SWR-cached so the
  // second draft of the day usually reuses inventory the first fetched.
  const CONCURRENCY = 3;
  const results: Array<{ dayIndex: number; added?: number; error?: string }> = [];
  for (let start = 0; start < totalDays; start += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, totalDays - start) },
      (_, i) => start + i,
    );
    const batchResults = await Promise.all(
      batch.map(async (dayIndex) => {
        const res = await draftDayPlan(tripId, dayIndex);
        return { dayIndex, ...res };
      }),
    );
    results.push(...batchResults);
  }

  const totalAdded = results.reduce((s, r) => s + (r.added ?? 0), 0);
  revalidatePath(`/trips/${tripId}/plan`);
  return { totalDays, addedByDay: results, totalAdded };
}
