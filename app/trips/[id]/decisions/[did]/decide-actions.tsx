"use client";

import { useTransition, useState } from "react";
import { markDecided, reopenDecision } from "../actions";

export function DecideActions({
  mode,
  tripId,
  decisionId,
  winningOptionId,
}: {
  mode: "revealed" | "decided";
  tripId: string;
  decisionId: string;
  winningOptionId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (mode === "revealed" && winningOptionId) {
    return (
      <div>
        <button
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await markDecided(decisionId, winningOptionId, tripId);
              if (res.error) setError(res.error);
            });
          }}
          disabled={pending}
          className="btn btn-accent w-full text-sm"
        >
          {pending ? "Deciding..." : "Pick this one →"}
        </button>
        {error && (
          <p className="text-xs text-[color:var(--color-danger)] mt-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (mode === "decided") {
    return (
      <div className="card p-4">
        <p className="text-sm text-[color:var(--color-fg-2)] mb-3">
          Changed your minds?
        </p>
        <button
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await reopenDecision(decisionId, tripId);
              if (res.error) setError(res.error);
            });
          }}
          disabled={pending}
          className="btn btn-ghost text-sm"
        >
          {pending ? "Reopening..." : "Reopen decision"}
        </button>
        {error && (
          <p className="text-xs text-[color:var(--color-danger)] mt-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  return null;
}
