"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type CreateTripState = { error?: string };

export async function createTrip(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const destination =
    String(formData.get("destination") ?? "").trim() || null;
  const startRaw = String(formData.get("start_date") ?? "").trim();
  const endRaw = String(formData.get("end_date") ?? "").trim();
  const start_date = startRaw || null;
  const end_date = endRaw || null;

  if (name.length < 1 || name.length > 120) {
    return { error: "Trip name must be 1-120 characters." };
  }
  if (destination && destination.length > 120) {
    return { error: "Destination must be 120 characters or fewer." };
  }
  if (start_date && end_date && start_date > end_date) {
    return { error: "End date can't be before start date." };
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      name,
      destination,
      start_date,
      end_date,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !trip) {
    return { error: error?.message ?? "Failed to create trip." };
  }

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

export async function createInvite(tripId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invite, error } = await supabase
    .from("trip_invites")
    .insert({ trip_id: tripId, created_by: user.id })
    .select("token")
    .single();

  if (error || !invite) {
    throw new Error(error?.message ?? "Failed to create invite.");
  }
  revalidatePath(`/trips/${tripId}`);
  return invite.token as string;
}

export async function acceptInvite(token: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);

  const { data: tripId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!tripId) throw new Error("Invite could not be accepted.");

  revalidatePath("/trips");
  return tripId as string;
}
