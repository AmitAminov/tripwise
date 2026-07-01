"use client";

import { useActionState } from "react";
import { createDecision, type CreateDecisionState } from "./actions";

const CATEGORIES = [
  { value: "lodging", label: "Lodging" },
  { value: "food", label: "Food" },
  { value: "activity", label: "Activity" },
  { value: "transit", label: "Transit" },
  { value: "day_plan", label: "Day plan" },
  { value: "other", label: "Other" },
] as const;

const initialState: CreateDecisionState = {};

export function NewDecisionForm({ tripId }: { tripId: string }) {
  const action = createDecision.bind(null, tripId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card p-4">
      <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
        New decision
      </div>
      <label className="block mb-3">
        <span className="field-label">What are we deciding?</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          placeholder="Where should we eat Tuesday night?"
          className="field"
        />
      </label>
      <label className="block mb-4">
        <span className="field-label">Category</span>
        <select name="category" defaultValue="food" className="field">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {state.error && (
        <p className="text-sm text-[color:var(--color-danger)] mb-3">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creating..." : "Create decision"}
      </button>
    </form>
  );
}
