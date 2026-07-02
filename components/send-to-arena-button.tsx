"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDecisionFromCandidates } from "@/app/trips/[id]/decisions/actions";
import type { DecisionSeed } from "@/app/trips/[id]/decisions/actions";

/**
 * Universal "Save these candidates to the decision arena" button.
 * Used from Flights, Hotels, Attractions to hand a curated list of
 * options straight into the reveal-mechanic decision flow.
 */
export function SendToArenaButton({
  tripId,
  seed,
  label,
  className = "btn btn-primary text-sm",
}: {
  tripId: string;
  seed: DecisionSeed;
  label?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createDecisionFromCandidates(tripId, seed);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.decisionId) {
        router.push(`/trips/${tripId}/decisions/${res.decisionId}`);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={submit}
        disabled={pending}
        className={className}
        title="Create a decision with these as candidates and open the reveal-mechanic rating flow"
      >
        {pending ? "Sending…" : (label ?? "Save to decision arena →")}
      </button>
      {error && (
        <p className="text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
