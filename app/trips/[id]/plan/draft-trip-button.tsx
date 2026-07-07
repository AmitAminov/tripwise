"use client";

import { useState, useTransition } from "react";
import { draftAllDaysPlan } from "./ai-actions";

/**
 * "Draft trip with AI" — one click, populates every day of the trip.
 * Complements the per-day AIDraftButton (which stays on each day card
 * for when you want to redraft just one day).
 */
export function DraftTripButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function draft() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await draftAllDaysPlan(tripId);
      if (res.error) {
        setError(res.error);
        return;
      }
      const days = res.totalDays ?? 0;
      const added = res.totalAdded ?? 0;
      const failed = (res.addedByDay ?? []).filter((d) => d.error).length;
      if (added === 0 && failed > 0) {
        setError(
          `Couldn't draft any day (${failed}/${days} failed). Check your Gemini + Places keys and try again.`,
        );
      } else {
        setFlash(
          `Added ${added} item${added === 1 ? "" : "s"} across ${days - failed}/${days} day${days === 1 ? "" : "s"}${failed > 0 ? ` · ${failed} failed` : ""}. Edit any that don't fit.`,
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
