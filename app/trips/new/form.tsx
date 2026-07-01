"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "../actions";

const initialState: CreateTripState = {};

const inputClass =
  "w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:border-[color:var(--color-accent)]";
const labelClass = "block text-sm mb-2 text-[color:var(--color-muted)]";

export function NewTripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Trip name</span>
        <input
          type="text"
          name="name"
          required
          maxLength={120}
          placeholder="Lisbon, autumn 2026"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Destination (optional)</span>
        <input
          type="text"
          name="destination"
          maxLength={120}
          placeholder="Lisbon, Portugal"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Start date</span>
          <input type="date" name="start_date" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>End date</span>
          <input type="date" name="end_date" className={inputClass} />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[color:var(--color-accent)] text-black font-medium py-2.5 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Creating..." : "Create trip"}
      </button>
    </form>
  );
}
