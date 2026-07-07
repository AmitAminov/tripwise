"use client";

import { useState, useTransition } from "react";
import { pickChoice } from "./choice-actions";

export interface ChoiceOption {
  id: string;
  label: string;
  notes: string | null;
  url: string | null;
  position: number;
}

export interface DayChoice {
  id: string;
  title: string;
  slot: "morning" | "afternoon" | "evening" | "any";
  winningOptionId: string | null;
  options: ChoiceOption[];
}

const SLOT_LABEL: Record<DayChoice["slot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Anytime",
};

/**
 * One MCQ per row. Click an option → server marks the decision decided
 * AND inserts the pick as an itinerary_item so it shows up alongside
 * manually-added stops. Optimistic UI: the button flips immediately.
 */
export function DayChoices({
  tripId,
  choices,
}: {
  tripId: string;
  choices: DayChoice[];
}) {
  if (choices.length === 0) return null;
  return (
    <div className="space-y-4 mb-4">
      {choices.map((c) => (
        <ChoiceRow key={c.id} tripId={tripId} choice={c} />
      ))}
    </div>
  );
}

function ChoiceRow({
  tripId,
  choice,
}: {
  tripId: string;
  choice: DayChoice;
}) {
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(choice.winningOptionId);
  const [error, setError] = useState<string | null>(null);

  function onPick(optionId: string) {
    const prev = picked;
    setPicked(optionId); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await pickChoice(tripId, choice.id, optionId);
      if (res.error) {
        setError(res.error);
        setPicked(prev); // revert
      }
    });
  }

  return (
    <div className="rounded-[var(--radius)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
            {SLOT_LABEL[choice.slot]}
          </div>
          <div className="text-sm font-medium">{choice.title}</div>
        </div>
        {pending && (
          <span className="text-[10px] text-[color:var(--color-muted)] shrink-0">
            Saving…
          </span>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {choice.options.map((opt) => {
          const isPicked = picked === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onPick(opt.id)}
                disabled={pending}
                aria-pressed={isPicked}
                className={
                  isPicked
                    ? "text-left w-full rounded-md border p-3 transition-colors bg-[color:var(--color-primary)] border-[color:var(--color-primary)] text-white"
                    : "text-left w-full rounded-md border p-3 transition-colors bg-[color:var(--color-surface)] border-[color:var(--color-line)] hover:border-[color:var(--color-line-2)]"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {opt.label}
                  </span>
                  {isPicked && (
                    <span aria-hidden className="text-xs shrink-0">
                      ✓
                    </span>
                  )}
                </div>
                {opt.notes && (
                  <div
                    className={
                      isPicked
                        ? "text-[11px] mt-1 text-white/80"
                        : "text-[11px] mt-1 text-[color:var(--color-muted)]"
                    }
                  >
                    {opt.notes}
                  </div>
                )}
                {opt.url && (
                  <div
                    className={
                      isPicked
                        ? "text-[10px] mt-1 text-white/70 truncate"
                        : "text-[10px] mt-1 text-[color:var(--color-subtle)] truncate"
                    }
                  >
                    {opt.url.replace(/^https?:\/\//, "").split("/")[0]}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-xs text-[color:var(--color-danger)] mt-2">{error}</p>
      )}
    </div>
  );
}
