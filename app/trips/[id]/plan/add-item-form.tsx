"use client";

import { useState, useRef, useTransition } from "react";
import { addItineraryItem } from "./actions";

const SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Anytime" },
] as const;

export function AddItemForm({
  tripId,
  dayIndex,
}: {
  tripId: string;
  dayIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string>("any");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addItineraryItem(tripId, dayIndex, slot, formData);
      if (res.error) {
        setError(res.error);
      } else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-ghost w-full text-sm"
      >
        + Add item
      </button>
    );
  }

  return (
    <form
      action={onSubmit}
      ref={formRef}
      className="border border-[color:var(--color-line)] rounded-md p-3 bg-[color:var(--color-surface-2)]"
    >
      <div className="mb-2 flex gap-2 flex-wrap">
        {SLOTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSlot(s.value)}
            className="chip"
            data-selected={slot === s.value}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        name="title"
        required
        maxLength={200}
        placeholder="Sushi at Ceresio 7"
        className="field mb-2"
        autoFocus
      />
      <input
        type="text"
        name="notes"
        maxLength={300}
        placeholder="Reserve ahead — rooftop views (optional)"
        className="field mb-3"
      />
      {error && (
        <p className="text-xs text-[color:var(--color-danger)] mb-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary text-sm"
        >
          {pending ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="btn btn-ghost text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
