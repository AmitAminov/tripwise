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

export type DecisionSeed = {
  title: string;
  category:
    | "lodging"
    | "food"
    | "activity"
    | "transit"
    | "day_plan"
    | "other";
  options: Array<{
    label: string;
    url?: string | null;
    notes?: string | null;
  }>;
};

/**
 * Composite action: create a decision + all its candidate options in one
 * transaction (best-effort — we roll back on option-insert failure).
 * Called from the flight/hotel/attraction "Save to decision arena"
 * buttons so users can jump straight from browsing candidates to
 * rating them.
 */
export async function createDecisionFromCandidates(
  tripId: string,
  seed: DecisionSeed,
): Promise<{ error?: string; decisionId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = seed.title.trim();
  if (title.length < 1 || title.length > 200) {
    return { error: "Decision title must be 1-200 characters." };
  }
  if (!isCategory(seed.category)) {
    return { error: "Invalid category." };
  }
  const options = seed.options
    .map((o, i) => ({
      label: (o.label ?? "").trim(),
      url: o.url?.trim() || null,
      notes: o.notes?.trim() || null,
      position: i,
    }))
    .filter((o) => o.label.length > 0 && o.label.length <= 200);
  if (options.length < 2) {
    return { error: "Need at least 2 non-empty options." };
  }

  const { data: decision, error: createErr } = await supabase
    .from("decisions")
    .insert({
      trip_id: tripId,
      title,
      category: seed.category,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (createErr || !decision) {
    return { error: createErr?.message ?? "Failed to create decision." };
  }

  const inserts = options.map((o) => ({
    decision_id: decision.id,
    label: o.label,
    url: o.url,
    notes: o.notes,
    position: o.position,
  }));

  const { error: optErr } = await supabase.from("options").insert(inserts);
  if (optErr) {
    // Roll back — orphan decision would just clutter the arena.
    await supabase.from("decisions").delete().eq("id", decision.id);
    return { error: optErr.message };
  }

  revalidatePath(`/trips/${tripId}/decisions`);
  return { decisionId: decision.id };
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
