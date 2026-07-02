"use server";

import { createClient } from "@/lib/supabase/server";
import { generateText } from "@/lib/ai/gemini";
import { placesProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { geocode } from "@/lib/geocoding";
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

  // Pull real Places data (top attractions + restaurants) to ground the model.
  const provider = placesProvider();
  const placeLines: string[] = [];
  if (provider && coords) {
    const [attractions, restaurants] = await Promise.all([
      provider.search({
        center: coords,
        kind: "attractions",
        radiusMeters: 5000,
        limit: 10,
      }),
      provider.search({
        center: coords,
        kind: "restaurants",
        radiusMeters: 5000,
        limit: 8,
      }),
    ]);
    for (const p of attractions.data ?? []) {
      const rating = p.rating ? ` [${p.rating.toFixed(1)}★]` : "";
      placeLines.push(`- ${p.name}${rating} (attraction)`);
    }
    for (const p of restaurants.data ?? []) {
      const rating = p.rating ? ` [${p.rating.toFixed(1)}★]` : "";
      placeLines.push(`- ${p.name}${rating} (restaurant)`);
    }
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
- Consider walking distance and jet-lag on the first day
- Autumn 2026 weather-appropriate
- Reflect that the travelers are a couple, not a group tour
- Do NOT recommend anything already on their existing plan
- Prefer items that fit with their already-decided choices${
    decidedLines ? " (listed below)" : ""
  }
- Notes are one short sentence — a booking hint, a timing tip, or why this over the obvious pick

Real places nearby (rated on Google Maps — prefer these):
${placeLines.join("\n") || "(none — Places API not available; use general knowledge)"}

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

  // Geocode each drafted item title within the destination context
  // so Routes can compute walking-time chips between consecutive items.
  // Run all lookups in parallel — geocoding is cached in-memory.
  const drafts = parsed.items.filter((it) => it.title && isSlot(it.slot));
  const geocoded = await Promise.all(
    drafts.map((it) =>
      geocode(`${it.title}, ${destination}`).catch(() => null),
    ),
  );

  const inserts = drafts.map((it, i) => {
    const slot = it.slot as Slot;
    const pos = positionsBySlot.get(slot) ?? 0;
    positionsBySlot.set(slot, pos + 1);
    // Tag AI-drafted notes so the provenance is preserved in the DB
    // (spec: clearly label AI-generated content). Users can freely
    // edit or remove the tag.
    const rawNotes = it.notes?.slice(0, 260) ?? "";
    const notes = rawNotes ? `${rawNotes} · [AI draft]` : "[AI draft]";
    const geoHit = geocoded[i];
    return {
      trip_id: tripId,
      day_index: dayIndex,
      slot,
      position: pos,
      title: it.title.slice(0, 200),
      notes,
      address: geoHit?.formattedAddress ?? null,
      coords_lat: geoHit?.coords.lat ?? null,
      coords_lng: geoHit?.coords.lng ?? null,
      created_by: user.id,
    };
  });

  if (inserts.length === 0) return { error: "No valid items to insert." };

  const { error } = await supabase.from("itinerary_items").insert(inserts);
  if (error) return { error: error.message };

  revalidatePath(`/trips/${tripId}/plan`);
  return { added: inserts.length };
}
