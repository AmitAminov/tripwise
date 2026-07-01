"use client";

import { useOptimistic, useTransition } from "react";
import { rateOption } from "../actions";

export function OptionRating({
  optionId,
  initialScore,
  tripId,
  decisionId,
}: {
  optionId: string;
  initialScore: number | null;
  tripId: string;
  decisionId: string;
}) {
  const [optimisticScore, setOptimisticScore] = useOptimistic(initialScore);
  const [pending, startTransition] = useTransition();

  function rate(newScore: number) {
    startTransition(async () => {
      setOptimisticScore(newScore);
      await rateOption(optionId, newScore, tripId, decisionId);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = optimisticScore != null && n <= optimisticScore;
          return (
            <button
              key={n}
              type="button"
              onClick={() => rate(n)}
              disabled={pending}
              aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
              className="p-1 transition-transform hover:scale-110 disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill={filled ? "var(--color-highlight)" : "none"}
                stroke={
                  filled ? "var(--color-highlight)" : "var(--color-line-2)"
                }
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <path d="M12 2l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.77 5.82 21l1.18-6.87-5-4.87 6.91-1L12 2z" />
              </svg>
            </button>
          );
        })}
      </div>
      <span className="text-xs text-[color:var(--color-muted)]">
        {optimisticScore == null
          ? "Tap to rate"
          : `You: ${optimisticScore}/5`}
      </span>
    </div>
  );
}
