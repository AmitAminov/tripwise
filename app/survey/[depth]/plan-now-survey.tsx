"use client";

import { useState, useTransition } from "react";
import { submitPlanNow } from "./actions";
import { INTEREST_OPTIONS } from "@/lib/types/trip-intent";
import { DESTINATIONS } from "@/data/destinations";

const COMFORT_LEVELS = [
  { value: "budget", label: "Budget" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
] as const;

const PACES = [
  { value: "relaxed", label: "Relaxed", hint: "Long meals, unhurried" },
  { value: "balanced", label: "Balanced", hint: "Some plans, some drift" },
  { value: "packed", label: "Packed", hint: "See everything" },
] as const;

// Selected-state utility — used everywhere the same visual language applies.
const selectedCard =
  "bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)] shadow-sm";
const unselectedCard =
  "bg-[color:var(--color-surface)] text-[color:var(--color-fg)] border-[color:var(--color-line)] hover:border-[color:var(--color-line-2)]";

export function PlanNowSurvey() {
  const [candidates, setCandidates] = useState<string[]>(
    DESTINATIONS.map((d) => d.id),
  );
  const [interests, setInterests] = useState<string[]>([
    "food",
    "culture",
    "architecture",
  ]);
  const [comfort, setComfort] = useState<string>("standard");
  const [pace, setPace] = useState<string>("balanced");
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  async function onSubmit(formData: FormData) {
    candidates.forEach((c) => formData.append("candidates", c));
    interests.forEach((i) => formData.append("interests", i));
    formData.set("comfort", comfort);
    formData.set("pace", pace);
    startTransition(() => submitPlanNow(formData));
  }

  return (
    <form action={onSubmit} className="space-y-8">
      {/* Candidates */}
      <fieldset>
        <legend className="field-label mb-3">
          Which destinations are we comparing?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DESTINATIONS.map((d) => {
            const on = candidates.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(candidates, setCandidates, d.id)}
                className={`text-left rounded-[var(--radius)] p-3 border transition-all ${
                  on ? selectedCard : unselectedCard
                }`}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{d.name}</div>
                  <SelectionCheck on={on} />
                </div>
                <div
                  className={`text-xs ${on ? "text-white/70" : "text-[color:var(--color-muted)]"}`}
                >
                  {d.country}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--color-muted)] mt-2">
          Deselect any you don&apos;t want ranked.
        </p>
      </fieldset>

      {/* Dates */}
      <fieldset>
        <legend className="field-label mb-2">When?</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-[color:var(--color-muted)] mb-1 block">
              Start
            </span>
            <input
              type="date"
              name="start_date"
              defaultValue="2026-09-20"
              min="2026-09-01"
              max="2026-11-30"
              className="field"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--color-muted)] mb-1 block">
              End
            </span>
            <input
              type="date"
              name="end_date"
              defaultValue="2026-09-27"
              min="2026-09-01"
              max="2026-11-30"
              className="field"
            />
          </label>
        </div>
      </fieldset>

      {/* Travelers */}
      <fieldset>
        <legend className="field-label mb-2">Who&apos;s going?</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-[color:var(--color-muted)] mb-1 block">
              Adults
            </span>
            <input
              type="number"
              name="adults"
              defaultValue={2}
              min={1}
              max={10}
              className="field"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--color-muted)] mb-1 block">
              Children
            </span>
            <input
              type="number"
              name="children"
              defaultValue={0}
              min={0}
              max={10}
              className="field"
            />
          </label>
        </div>
      </fieldset>

      {/* Budget */}
      <fieldset>
        <legend className="field-label mb-2">Budget per person (USD)</legend>
        <input
          type="number"
          name="budget_per_person"
          defaultValue={1500}
          min={100}
          step={50}
          className="field mb-3"
        />
        <div className="flex flex-wrap gap-2">
          {COMFORT_LEVELS.map((c) => {
            const on = comfort === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setComfort(c.value)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
                  on ? selectedCard : unselectedCard
                }`}
                aria-pressed={on}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Vibe */}
      <fieldset>
        <legend className="field-label mb-2">
          What are you into?{" "}
          <span className="text-[color:var(--color-muted)]">(pick a few)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((tag) => {
            const on = interests.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(interests, setInterests, tag)}
                className={`px-3 py-1 rounded-full text-sm border capitalize transition-all ${
                  on ? selectedCard : unselectedCard
                }`}
                aria-pressed={on}
              >
                {tag.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Pace */}
      <fieldset>
        <legend className="field-label mb-2">Pace</legend>
        <div className="grid grid-cols-3 gap-2">
          {PACES.map((p) => {
            const on = pace === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPace(p.value)}
                className={`text-left rounded-[var(--radius)] p-3 border transition-all ${
                  on ? selectedCard : unselectedCard
                }`}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.label}</span>
                  <SelectionCheck on={on} />
                </div>
                <div
                  className={`text-xs mt-1 ${
                    on ? "text-white/70" : "text-[color:var(--color-muted)]"
                  }`}
                >
                  {p.hint}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="pt-4 border-t border-[color:var(--color-line)]">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full"
        >
          {pending ? "Ranking destinations..." : "Rank the destinations →"}
        </button>
      </div>
    </form>
  );
}

function SelectionCheck({ on }: { on: boolean }) {
  return (
    <span
      className={`ml-2 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
        on
          ? "bg-white text-[color:var(--color-primary)]"
          : "border border-[color:var(--color-line-2)] text-transparent"
      }`}
      aria-hidden
    >
      ✓
    </span>
  );
}
