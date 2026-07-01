"use client";

import { useActionState, useEffect, useRef } from "react";
import { addOption, type AddOptionState } from "../actions";

const initialState: AddOptionState = {};

export function AddOptionForm({
  decisionId,
  tripId,
}: {
  decisionId: string;
  tripId: string;
}) {
  const action = addOption.bind(null, decisionId, tripId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    // Reset the form on successful submit — the returned state has no error.
    if (!pending && !state.error && formRef.current) {
      formRef.current.reset();
    }
  }, [pending, state]);

  return (
    <form action={formAction} ref={formRef} className="card p-4">
      <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
        Add an option
      </div>
      <label className="block mb-3">
        <span className="field-label">Label</span>
        <input
          type="text"
          name="label"
          required
          maxLength={200}
          placeholder="Cervejaria Ramiro"
          className="field"
        />
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="field-label">Link (optional)</span>
          <input
            type="url"
            name="url"
            placeholder="https://..."
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">Notes (optional)</span>
          <input
            type="text"
            name="notes"
            maxLength={300}
            placeholder="Late-night seafood, walking distance from hotel"
            className="field"
          />
        </label>
      </div>
      {state.error && (
        <p className="text-sm text-[color:var(--color-danger)] mb-3">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Adding..." : "Add option"}
      </button>
    </form>
  );
}
