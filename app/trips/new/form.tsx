"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "../actions";

const initialState: CreateTripState = {};

export function NewTripForm({
  defaultName,
  defaultDestination,
  defaultStart,
  defaultEnd,
}: {
  defaultName?: string;
  defaultDestination?: string;
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="field-label">Trip name</span>
        <input
          type="text"
          name="name"
          required
          maxLength={120}
          defaultValue={defaultName ?? ""}
          placeholder={defaultDestination ? `${defaultDestination} · Autumn 2026` : "Autumn 2026"}
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">Destination (optional)</span>
        <input
          type="text"
          name="destination"
          maxLength={120}
          defaultValue={defaultDestination ?? ""}
          placeholder="Bangkok · Prague · Naples"
          className="field"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Start date</span>
          <input
            type="date"
            name="start_date"
            defaultValue={defaultStart ?? ""}
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">End date</span>
          <input
            type="date"
            name="end_date"
            defaultValue={defaultEnd ?? ""}
            className="field"
          />
        </label>
      </div>

      {state.error && (
        <p className="text-sm text-[color:var(--color-danger)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full"
      >
        {pending ? "Creating..." : "Create trip"}
      </button>
    </form>
  );
}
