"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const CATEGORIES = [
  "lodging",
  "food",
  "activity",
  "transit",
  "day_plan",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

export type CreateDecisionState = { error?: string };

export async function createDecision(
  tripId: string,
  _prev: CreateDecisionState,
  formData: FormData,
): Promise<CreateDecisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const catRaw = String(formData.get("category") ?? "other");
  const category: Category = isCategory(catRaw) ? catRaw : "other";

  if (title.length < 1 || title.length > 200) {
    return { error: "Title must be 1-200 characters." };
  }

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      trip_id: tripId,
      title,
      category,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create decision." };
  }
  revalidatePath(`/trips/${tripId}/decisions`);
  redirect(`/trips/${tripId}/decisions/${data.id}`);
}

export type AddOptionState = { error?: string };

export async function addOption(
  decisionId: string,
  tripId: string,
  _prev: AddOptionState,
  formData: FormData,
): Promise<AddOptionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (label.length < 1 || label.length > 200) {
    return { error: "Option label must be 1-200 characters." };
  }

  // Compute position = current max position + 1
  const { data: existing } = await supabase
    .from("options")
    .select("position")
    .eq("decision_id", decisionId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("options").insert({
    decision_id: decisionId,
    label,
    url,
    notes,
    position: nextPosition,
  });

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/decisions/${decisionId}`);
  return {};
}

export async function rateOption(
  optionId: string,
  score: number,
  tripId: string,
  decisionId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (score < 1 || score > 5) return { error: "Score must be 1-5." };

  // Upsert on (option_id, user_id)
  const { error } = await supabase
    .from("ratings")
    .upsert(
      {
        option_id: optionId,
        user_id: user.id,
        score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "option_id,user_id" },
    );

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/decisions/${decisionId}`);
  return {};
}

export async function markDecided(
  decisionId: string,
  winningOptionId: string,
  tripId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("decisions")
    .update({
      status: "decided",
      winning_option_id: winningOptionId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", decisionId);

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/decisions/${decisionId}`);
  revalidatePath(`/trips/${tripId}/decisions`);
  return {};
}

export async function reopenDecision(
  decisionId: string,
  tripId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("decisions")
    .update({
      status: "open",
      winning_option_id: null,
      decided_at: null,
    })
    .eq("id", decisionId);

  if (error) return { error: error.message };
  revalidatePath(`/trips/${tripId}/decisions/${decisionId}`);
  revalidatePath(`/trips/${tripId}/decisions`);
  return {};
}
