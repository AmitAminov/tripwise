import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { AddOptionForm } from "./add-option-form";
import { OptionRating } from "./option-rating";
import { RevealCard } from "./reveal-card";
import { DecideActions } from "./decide-actions";

const CATEGORY_LABELS: Record<string, string> = {
  lodging: "Lodging",
  food: "Food",
  activity: "Activity",
  transit: "Transit",
  day_plan: "Day plan",
  other: "Other",
};

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string; did: string }>;
}) {
  const { id: tripId, did: decisionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, category, status, winning_option_id, decided_at")
    .eq("id", decisionId)
    .maybeSingle();
  if (!decision) notFound();

  const { data: options } = await supabase
    .from("options")
    .select("id, label, url, notes, position")
    .eq("decision_id", decisionId)
    .order("position", { ascending: true });

  const optionIds = (options ?? []).map((o) => o.id);
  const { data: ratings } =
    optionIds.length > 0
      ? await supabase
          .from("ratings")
          .select("option_id, user_id, score")
          .in("option_id", optionIds)
      : { data: [] as { option_id: string; user_id: string; score: number }[] };

  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id, profiles!inner(display_name)")
    .eq("trip_id", tripId);

  const memberCount = members?.length ?? 0;
  const otherMembers = (members ?? []).filter((m) => m.user_id !== user.id);
  const otherMember = otherMembers[0];
  let otherName: string | null = null;
  if (otherMember) {
    const profile = Array.isArray(otherMember.profiles)
      ? otherMember.profiles[0]
      : otherMember.profiles;
    otherName = profile?.display_name ?? null;
  }

  // Derived: how many of MY ratings exist for this decision?
  const myRatingsMap = new Map(
    (ratings ?? [])
      .filter((r) => r.user_id === user.id)
      .map((r) => [r.option_id, r.score] as const),
  );
  const myRatedCount = myRatingsMap.size;
  const totalOptions = optionIds.length;
  const iHaveRatedAll = totalOptions > 0 && myRatedCount === totalOptions;

  const isOpen = decision.status === "open";
  const isRevealed = decision.status === "revealed";
  const isDecided = decision.status === "decided";

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-3xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href={`/trips/${tripId}/decisions`}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← All decisions
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            {CATEGORY_LABELS[decision.category] ?? decision.category} · {trip.name}
          </div>
          <h1 className="font-serif text-3xl">{decision.title}</h1>
        </div>

        {/* Status banner */}
        <StatusBanner
          status={decision.status}
          iHaveRatedAll={iHaveRatedAll}
          totalOptions={totalOptions}
          myRatedCount={myRatedCount}
          otherName={otherName ?? "your partner"}
          memberCount={memberCount}
        />

        {/* Options list */}
        <section className="mb-6 space-y-3">
          {(options ?? []).map((opt) => {
            const optionRatings = (ratings ?? []).filter(
              (r) => r.option_id === opt.id,
            );
            const myScore = myRatingsMap.get(opt.id) ?? null;
            const isWinner = decision.winning_option_id === opt.id;

            if (isRevealed || isDecided) {
              return (
                <RevealCard
                  key={opt.id}
                  option={opt}
                  ratings={optionRatings}
                  currentUserId={user.id}
                  isWinner={isWinner}
                  canDecide={isRevealed}
                  tripId={tripId}
                  decisionId={decisionId}
                />
              );
            }

            return (
              <div key={opt.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-medium">{opt.label}</div>
                    {opt.url && (
                      <a
                        href={opt.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-[color:var(--color-primary)] hover:underline truncate block"
                      >
                        {opt.url}
                      </a>
                    )}
                    {opt.notes && (
                      <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
                        {opt.notes}
                      </p>
                    )}
                  </div>
                </div>
                <OptionRating
                  optionId={opt.id}
                  initialScore={myScore}
                  tripId={tripId}
                  decisionId={decisionId}
                />
              </div>
            );
          })}
          {(!options || options.length === 0) && (
            <div className="card p-6 text-center text-[color:var(--color-muted)] text-sm">
              No options yet. Add a few below — restaurants, hotels, day-trip
              ideas, whatever you&apos;re deciding between.
            </div>
          )}
        </section>

        {/* Add option — hidden once decided */}
        {!isDecided && (
          <section className="mb-6">
            <AddOptionForm
              decisionId={decisionId}
              tripId={tripId}
            />
          </section>
        )}

        {/* Decided reopen action */}
        {isDecided && (
          <section>
            <DecideActions
              mode="decided"
              tripId={tripId}
              decisionId={decisionId}
              winningOptionId={null}
            />
          </section>
        )}
      </main>
    </>
  );
}

function StatusBanner({
  status,
  iHaveRatedAll,
  totalOptions,
  myRatedCount,
  otherName,
  memberCount,
}: {
  status: string;
  iHaveRatedAll: boolean;
  totalOptions: number;
  myRatedCount: number;
  otherName: string;
  memberCount: number;
}) {
  if (status === "decided") {
    return (
      <div className="card p-4 mb-6 bg-[color:var(--color-accent)]/10">
        <div className="status-est status-live">
          <span className="status-dot" /> Decided
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
          The winning option is highlighted below.
        </p>
      </div>
    );
  }
  if (status === "revealed") {
    return (
      <div
        className="card p-4 mb-6"
        style={{ background: "rgba(201, 169, 97, 0.12)" }}
      >
        <div className="status-est status-cached">
          <span className="status-dot" /> Ready to decide
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
          Both of you finished rating. Scroll down to see how the
          combined scores fell — then pick a winner.
        </p>
      </div>
    );
  }
  // open
  if (memberCount < 2) {
    return (
      <div className="card p-4 mb-6">
        <div className="status-est">
          <span className="status-dot" /> Waiting for a partner
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
          You&apos;re the only member of this trip. Send{" "}
          <Link href="../.." className="text-[color:var(--color-primary)] underline">
            the invite link
          </Link>{" "}
          so someone can rate alongside you.
        </p>
      </div>
    );
  }
  if (totalOptions === 0) {
    return (
      <div className="card p-4 mb-6">
        <div className="status-est">
          <span className="status-dot" /> Add options
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
          Add at least 2 options to start rating.
        </p>
      </div>
    );
  }
  if (iHaveRatedAll) {
    return (
      <div className="card p-4 mb-6">
        <div className="status-est">
          <span className="status-dot" /> Waiting for {otherName}
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
          You&apos;ve rated all {totalOptions} option
          {totalOptions === 1 ? "" : "s"}. The reveal opens when they
          finish rating too.
        </p>
      </div>
    );
  }
  return (
    <div className="card p-4 mb-6">
      <div className="status-est">
        <span className="status-dot" /> Your turn
      </div>
      <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
        Rate {myRatedCount} of {totalOptions} options rated. No one sees
        each other&apos;s scores until you&apos;re both done — rate
        honestly.
      </p>
    </div>
  );
}
