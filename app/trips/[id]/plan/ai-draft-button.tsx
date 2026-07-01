"use client";

import { useState, useTransition } from "react";
import { draftDayPlan } from "./ai-actions";

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
      const res = await draftDayPlan(tripId, dayIndex);
      if (res.error) {
        setError(res.error);
      } else if (res.added) {
        setFlash(
          `Added ${res.added} item${res.added === 1 ? "" : "s"}. Edit any that don't fit.`,
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
        title="Ask Gemini to sketch this day"
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
