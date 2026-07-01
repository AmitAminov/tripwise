"use client";

import { useState, useTransition } from "react";
import { removeItineraryItem, moveItineraryItem } from "./actions";

export function ItineraryItemRow({
  tripId,
  itemId,
  title,
  notes,
}: {
  tripId: string;
  itemId: string;
  title: string;
  notes: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeItineraryItem(tripId, itemId);
      if (res.error) setError(res.error);
    });
  }

  function move(direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const res = await moveItineraryItem(tripId, itemId, direction);
      if (res.error) setError(res.error);
    });
  }

  return (
    <li className="flex items-start gap-2 border border-[color:var(--color-line)] rounded-md p-3">
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => move("up")}
          disabled={pending}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)] disabled:opacity-40"
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          onClick={() => move("down")}
          disabled={pending}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)] disabled:opacity-40"
          aria-label="Move down"
        >
          ▼
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{title}</div>
        {notes && (
          <div className="text-xs text-[color:var(--color-muted)] truncate">
            {notes}
          </div>
        )}
        {error && (
          <div className="text-xs text-[color:var(--color-danger)] mt-1">
            {error}
          </div>
        )}
      </div>
      <button
        onClick={remove}
        disabled={pending}
        className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] disabled:opacity-40"
        aria-label="Remove item"
      >
        ✕
      </button>
    </li>
  );
}
