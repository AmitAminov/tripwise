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

  // Route through a security-definer RPC so the server derives auth.uid()
  // itself. This sidesteps the "new row violates RLS policy" failure mode
  // where the raw REST INSERT couldn't prove created_by = auth.uid().
  // Requires migration 003_create_trip_rpc.sql to be applied.
  const { data: rpcId, error: rpcError } = await supabase.rpc("create_trip", {
    p_name: name,
    p_destination: destination,
    p_start_date: start_date,
    p_end_date: end_date,
  });

  if (rpcError || !rpcId) {
    // If the RPC isn't installed yet, fall back to the legacy direct insert
    // so an un-migrated environment doesn't lock the user out entirely.
    const rpcMissing = /function .*create_trip.* does not exist/i.test(
      rpcError?.message ?? "",
    );
    if (!rpcMissing) {
      return {
        error:
          rpcError?.message ??
          "Failed to create trip. If this persists, apply the 003_create_trip_rpc migration.",
      };
    }

    const { data: trip, error: insertError } = await supabase
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

    if (insertError || !trip) {
      return {
        error:
          insertError?.message ??
          "Failed to create trip (RPC missing; direct INSERT also failed).",
      };
    }

    revalidatePath("/trips");
    redirect(`/trips/${trip.id}`);
  }

  revalidatePath("/trips");
  redirect(`/trips/${rpcId as string}`);
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
