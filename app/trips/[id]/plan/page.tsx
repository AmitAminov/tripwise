import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { AddItemForm } from "./add-item-form";
import { ItineraryItemRow } from "./item-row";
import { AIDraftButton } from "./ai-draft-button";
import { CalendarExportButton } from "@/components/calendar-export-button";
import {
  computeDayLegs,
  formatDistance,
  formatDuration,
  type RouteLeg,
} from "@/lib/providers/routes/google";

type Slot = "morning" | "afternoon" | "evening" | "any";

const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Anytime",
};

const SLOT_ORDER: Slot[] = ["morning", "afternoon", "evening", "any"];

interface ItineraryItem {
  id: string;
  day_index: number;
  slot: string;
  position: number;
  title: string;
  notes: string | null;
  address: string | null;
  coords_lat: number | null;
  coords_lng: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string;
}

function daysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 7;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) return 7;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(60, diff + 1));
}

function addDays(start: string, n: number): string {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Order items within a day: sorted by slot then position. */
function orderForDay(dayItems: ItineraryItem[]): ItineraryItem[] {
  const byOrder = { morning: 0, afternoon: 1, evening: 2, any: 3 } as const;
  return [...dayItems].sort((a, b) => {
    const sa = byOrder[a.slot as Slot] ?? 4;
    const sb = byOrder[b.slot as Slot] ?? 4;
    if (sa !== sb) return sa - sb;
    return a.position - b.position;
  });
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const totalDays = daysBetween(trip.start_date, trip.end_date);

  const { data: itemsRaw, error } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_index, slot, position, title, notes, address, coords_lat, coords_lng, starts_at, ends_at, created_by",
    )
    .eq("trip_id", id)
    .order("day_index", { ascending: true })
    .order("slot", { ascending: true })
    .order("position", { ascending: true });

  const items = (itemsRaw ?? []) as ItineraryItem[];

  const migrationMissing =
    error != null &&
    /relation .* does not exist|itinerary_items/i.test(error.message);

  // For each day, compute walking legs between consecutive items that
  // both have coords. In parallel across days so the page still renders
  // even if Routes is temperamental. Track per-day availability so we
  // can surface "walking times unavailable" per spec's reliability rule.
  const legsByDay = new Map<number, RouteLeg[]>();
  const routesUnavailableDays = new Set<number>();
  await Promise.all(
    Array.from({ length: totalDays }).map(async (_, dayIndex) => {
      const dayItems = items.filter((i) => i.day_index === dayIndex);
      const ordered = orderForDay(dayItems);
      const points = ordered
        .filter((i) => i.coords_lat != null && i.coords_lng != null)
        .map((i) => ({ lat: i.coords_lat!, lng: i.coords_lng! }));
      if (points.length < 2) return;
      const legs = await computeDayLegs(points, "WALK");
      if (legs && legs.length > 0) {
        legsByDay.set(dayIndex, legs);
      } else {
        // We had ≥2 geocoded items but Routes gave us nothing —
        // note it so the UI can degrade gracefully.
        routesUnavailableDays.add(dayIndex);
      }
    }),
  );

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href={`/trips/${trip.id}`}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← {trip.name}
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
              Day plan
            </div>
            <h1 className="font-serif text-3xl">
              {trip.destination ?? trip.name} · {totalDays} day
              {totalDays === 1 ? "" : "s"}
            </h1>
            {trip.start_date && trip.end_date && (
              <p className="text-sm text-[color:var(--color-muted)] mt-1">
                {trip.start_date} → {trip.end_date}
              </p>
            )}
          </div>
          <CalendarExportButton tripId={trip.id} />
        </div>

        {migrationMissing && (
          <div className="card p-6 mb-6">
            <div className="status-est status-error mb-2">
              <span className="status-dot" /> Migration not applied
            </div>
            <p className="text-sm text-[color:var(--color-fg-2)]">
              The <code>itinerary_items</code> table doesn&apos;t exist yet.
              Run <code>supabase/migrations/002_itinerary.sql</code> in your
              Supabase SQL Editor once and refresh.
            </p>
          </div>
        )}

        {!migrationMissing && error && (
          <div className="card p-6 mb-6">
            <div className="status-est status-error mb-2">
              <span className="status-dot" /> Couldn&apos;t load items
            </div>
            <p className="text-sm text-[color:var(--color-fg-2)]">
              {error.message}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {Array.from({ length: totalDays }).map((_, dayIndex) => {
            const dayItems = items.filter((i) => i.day_index === dayIndex);
            const ordered = orderForDay(dayItems);
            const withCoords = ordered.filter(
              (i) => i.coords_lat != null && i.coords_lng != null,
            );
            const dayLegs = legsByDay.get(dayIndex) ?? [];
            const dateStr =
              trip.start_date && addDays(trip.start_date, dayIndex);
            const weekday = dateStr
              ? WEEKDAY[new Date(dateStr).getUTCDay()]
              : null;
            const dayTotalMinutes = Math.round(
              dayLegs.reduce((acc, l) => acc + l.durationSeconds, 0) / 60,
            );
            return (
              <section key={dayIndex} className="card p-4">
                <header className="flex items-center justify-between mb-3 pb-3 border-b border-[color:var(--color-line)] gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                      Day {dayIndex + 1}
                    </div>
                    <div className="font-serif text-xl">
                      {weekday && dateStr ? `${weekday} ${dateStr}` : `Day ${dayIndex + 1}`}
                    </div>
                    {dayLegs.length > 0 && (
                      <div className="text-xs text-[color:var(--color-muted)] mt-1">
                        Walking between {dayLegs.length + 1} stops · ~
                        {dayTotalMinutes} min total
                      </div>
                    )}
                    {routesUnavailableDays.has(dayIndex) && (
                      <div className="text-xs text-[color:var(--color-warn)] mt-1">
                        Walking times unavailable — Routes API didn&apos;t
                        respond.
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[color:var(--color-muted)]">
                      {dayItems.length} item{dayItems.length === 1 ? "" : "s"}
                    </span>
                    <AIDraftButton tripId={trip.id} dayIndex={dayIndex} />
                  </div>
                </header>

                <div className="space-y-4">
                  {SLOT_ORDER.map((slot) => {
                    const slotItems = ordered.filter((i) => i.slot === slot);
                    if (slotItems.length === 0) return null;
                    return (
                      <div key={slot}>
                        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
                          {SLOT_LABELS[slot]}
                        </div>
                        <ul className="space-y-2">
                          {slotItems.map((it) => {
                            // Find the leg AFTER this item (leg N connects item N to N+1)
                            const withCoordsIdx = withCoords.findIndex(
                              (c) => c.id === it.id,
                            );
                            const nextLeg =
                              withCoordsIdx >= 0 &&
                              withCoordsIdx < dayLegs.length
                                ? dayLegs[withCoordsIdx]
                                : null;
                            return (
                              <li key={it.id}>
                                <ItineraryItemRow
                                  tripId={trip.id}
                                  itemId={it.id}
                                  title={it.title}
                                  notes={it.notes}
                                />
                                {nextLeg && (
                                  <div className="pl-8 py-2 flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                                    <span aria-hidden>↓</span>
                                    <span>
                                      Walk {formatDuration(nextLeg.durationSeconds)} ·{" "}
                                      {formatDistance(nextLeg.distanceMeters)}
                                    </span>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}

                  {/* Add form for this day */}
                  <AddItemForm tripId={trip.id} dayIndex={dayIndex} />
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
