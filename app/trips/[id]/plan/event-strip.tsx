"use client";

import { useState, useTransition } from "react";
import { addEventToPlan } from "./actions";

export interface PlanEventItem {
  id: string;
  name: string;
  startAt: string;
  venueName?: string;
  coordsLat?: number;
  coordsLng?: number;
  ticketUrl?: string;
  categories?: string[];
}

/**
 * "What's on tonight" — real events for a single day. Each event has a
 * one-click "Add to plan" that inserts an itinerary item at the slot
 * inferred from the event's start time. Preserves venue coords + ticket
 * URL so downstream (map pins, walking chips, notes) all just work.
 */
export function EventStrip({
  tripId,
  dayIndex,
  events,
  addedTitles,
}: {
  tripId: string;
  dayIndex: number;
  events: PlanEventItem[];
  addedTitles: Set<string>;
}) {
  if (events.length === 0) return null;
  return (
    <section
      className="mb-3 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-surface-2)] p-3"
      aria-label={`Live events happening on day ${dayIndex + 1}`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "#3a5f9e" }}
          />
          What&apos;s on
        </div>
        <div className="text-[10px] text-[color:var(--color-muted)]">
          {events.length} event{events.length === 1 ? "" : "s"} · live
        </div>
      </div>
      <ul className="space-y-2">
        {events.map((ev) => (
          <EventRow
            key={ev.id}
            tripId={tripId}
            dayIndex={dayIndex}
            ev={ev}
            alreadyAdded={addedTitles.has(ev.name.toLowerCase())}
          />
        ))}
      </ul>
    </section>
  );
}

function EventRow({
  tripId,
  dayIndex,
  ev,
  alreadyAdded,
}: {
  tripId: string;
  dayIndex: number;
  ev: PlanEventItem;
  alreadyAdded: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(alreadyAdded);
  const [error, setError] = useState<string | null>(null);

  function onAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addEventToPlan(tripId, dayIndex, ev);
      if (res.error) {
        setError(res.error);
      } else {
        setAdded(true);
      }
    });
  }

  const time = ev.startAt.slice(11, 16);
  const cats = (ev.categories ?? []).slice(0, 2);

  return (
    <li className="flex items-start gap-3 text-sm">
      <div className="text-[color:var(--color-muted)] tabular-nums shrink-0 w-11 text-xs pt-0.5">
        {time}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{ev.name}</div>
        <div className="text-xs text-[color:var(--color-muted)] flex flex-wrap gap-x-2 gap-y-0.5">
          {ev.venueName && <span className="truncate">{ev.venueName}</span>}
          {cats.length > 0 && <span>· {cats.join(", ")}</span>}
          {ev.ticketUrl && (
            <a
              href={ev.ticketUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[color:var(--color-primary)] hover:underline"
            >
              tickets ↗
            </a>
          )}
        </div>
        {error && (
          <div className="text-xs text-[color:var(--color-danger)] mt-1">
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={pending || added}
        className="btn btn-ghost text-xs px-2 py-1 shrink-0"
        title={added ? "Already on your plan" : "Add this event to your day plan"}
      >
        {added ? "On plan ✓" : pending ? "Adding…" : "+ Add"}
      </button>
    </li>
  );
}
