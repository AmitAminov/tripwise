"use client";

import { useState, useTransition } from "react";
import { draftTripChoices } from "./choice-actions";

/**
 * "Draft trip with AI" — populates every day of the trip with
 * structured MCQ choices from a bank (morning attraction, lunch
 * restaurant, evening events/bars). Idempotent — skips days that
 * already have decisions so re-clicking doesn't spam duplicates.
 *
 * Complements the per-day button (which redrafts one day at a time).
 */
export function DraftTripButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function draft() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await draftTripChoices(tripId);
      if (res.error) {
        setError(res.error);
        return;
      }
      const days = res.totalDays ?? 0;
      const created = res.totalCreated ?? 0;
      const failed = (res.createdByDay ?? []).filter((d) => d.error).length;
      const skipped = (res.createdByDay ?? []).filter(
        (d) => !d.error && (d.created ?? 0) === 0,
      ).length;
      if (created === 0 && failed > 0) {
        setError(
          `Couldn't draft any choices (${failed}/${days} days failed). Check your Places / events keys and try again.`,
        );
      } else if (created === 0 && skipped === days) {
        setFlash(
          `Every day already has choices. Pick from them below, or reset a day to redraft.`,
        );
      } else {
        setFlash(
          `Added ${created} choice${created === 1 ? "" : "s"} across ${days - failed - skipped}/${days} day${days === 1 ? "" : "s"}${skipped > 0 ? ` · ${skipped} skipped (already drafted)` : ""}${failed > 0 ? ` · ${failed} failed` : ""}. Pick one option per question.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={draft}
        disabled={pending}
        className="btn btn-accent text-sm"
        title="Ask Gemini to draft every day of this trip. Takes ~10-20s."
      >
        {pending ? "Drafting trip…" : "✨ Draft trip with AI"}
      </button>
      {error && (
        <p className="text-xs text-[color:var(--color-danger)]">{error}</p>
      )}
      {flash && (
        <p className="text-xs text-[color:var(--color-accent)]">{flash}</p>
      )}
    </div>
  );
}
