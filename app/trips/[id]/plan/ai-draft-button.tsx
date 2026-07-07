"use client";

import { useState, useTransition } from "react";
import { draftDayChoices } from "./choice-actions";

/**
 * Per-day "Draft with AI" — populates ONE day with structured MCQ
 * choices from a bank. Idempotent: if this day already has choices,
 * clicking is a no-op with a friendly message.
 */
export function AIDraftButton({
  tripId,
  dayIndex,
}: {
  tripId: string;
  dayIndex: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function draft() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await draftDayChoices(tripId, dayIndex);
      if (res.error) {
        setError(res.error);
      } else if ((res.created ?? 0) === 0) {
        setFlash(
          `Already has choices — pick from them below, or reset the day to redraft.`,
        );
      } else {
        setFlash(
          `Added ${res.created} choice${res.created === 1 ? "" : "s"}. Pick one option per question.`,
        );
      }
    });
  }

  return (
    <div>
      <button
        onClick={draft}
        disabled={pending}
        className="btn btn-ghost text-xs"
        title="Populate this day with MCQ choices from real places + events"
      >
        {pending ? "Drafting..." : "✨ Draft with AI"}
      </button>
      {error && (
        <p className="text-xs text-[color:var(--color-danger)] mt-2">
          {error}
        </p>
      )}
      {flash && (
        <p className="text-xs text-[color:var(--color-accent)] mt-2">
          {flash}
        </p>
      )}
    </div>
  );
}
