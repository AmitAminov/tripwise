"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { geocode } from "@/lib/geocoding";

type Slot = "morning" | "afternoon" | "evening" | "any";

const SLOTS: readonly Slot[] = ["morning", "afternoon", "evening", "any"];

function isSlot(v: string): v is Slot {
  return (SLOTS as readonly string[]).includes(v);
}

export async function addItineraryItem(
  tripId: string,
  dayIndex: number,
  slotRaw: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const slot: Slot = isSlot(slotRaw) ? slotRaw : "any";

  if (title.length < 1 || title.length > 200) {
    return { error: "Item title must be 1-200 characters." };
  }
  if (dayIndex < 0 || dayIndex > 60) {
    return { error: "Invalid day." };
  }

  const { data: existing } = await supabase
    .from("itinerary_items")
    .select("position")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex)
    .eq("slot", slot)
    .order("position", { ascending: false })
    .limit(1);
  const position = (existing?.[0]?.position ?? -1) + 1;

  // Best-effort geocode using the trip's destination as context so Routes
  // can later compute walking times between items. Silent on failure.
  const { data: trip } = await supabase
    .from("trips")
    .select("destination")
    .eq("id", tripId)
    .maybeSingle();
  const geoQuery = trip?.destination
    ? `${title}, ${trip.destination}`
    : title;
  const geo = await geocode(geoQuery).catch(() => null);

  const { error } = await supabase.from("itinerary_items").insert({
    trip_id: tripId,
    day_index: dayIndex,
    slot,
    position,
    title,
    notes,
    address: geo?.formattedAddress ?? null,
    coords_lat: geo?.coords.lat ?? null,
    coords_lng: geo?.coords.lng ?? null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/plan`);
  return {};
}

export async function removeItineraryItem(
  tripId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/plan`);
  return {};
}

export async function moveItineraryItem(
  tripId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("itinerary_items")
    .select("id, position, day_index, slot, trip_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { data: neighbours } = await supabase
    .from("itinerary_items")
    .select("id, position")
    .eq("trip_id", item.trip_id)
    .eq("day_index", item.day_index)
    .eq("slot", item.slot)
    .order("position", { ascending: true });

  if (!neighbours || neighbours.length < 2) return {};
  const idx = neighbours.findIndex((n) => n.id === item.id);
  if (idx === -1) return {};
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= neighbours.length) return {};

  const other = neighbours[swapIdx];
  // Two-step swap via a sentinel to avoid unique-conflict on (day, slot, position) if
  // it existed. (There is no unique constraint currently, so a direct swap is safe.)
  const { error: e1 } = await supabase
    .from("itinerary_items")
    .update({ position: other.position })
    .eq("id", item.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase
    .from("itinerary_items")
    .update({ position: item.position })
    .eq("id", other.id);
  if (e2) return { error: e2.message };

  revalidatePath(`/trips/${tripId}/plan`);
  return {};
}
