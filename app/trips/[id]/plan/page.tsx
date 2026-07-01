import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { AddItemForm } from "./add-item-form";
import { ItineraryItemRow } from "./item-row";
import { AIDraftButton } from "./ai-draft-button";
import { CalendarExportButton } from "@/components/calendar-export-button";

type Slot = "morning" | "afternoon" | "evening" | "any";

const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Anytime",
};

const SLOT_ORDER: Slot[] = ["morning", "afternoon", "evening", "any"];

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

  const { data: items, error } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_index, slot, position, title, notes, address, starts_at, ends_at, created_by",
    )
    .eq("trip_id", id)
    .order("day_index", { ascending: true })
    .order("slot", { ascending: true })
    .order("position", { ascending: true });

  const migrationMissing =
    error != null &&
    /relation .* does not exist|itinerary_items/i.test(error.message);

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
            const dayItems = (items ?? []).filter(
              (i) => i.day_index === dayIndex,
            );
            const dateStr =
              trip.start_date && addDays(trip.start_date, dayIndex);
            const weekday = dateStr
              ? WEEKDAY[new Date(dateStr).getUTCDay()]
              : null;
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
                    const slotItems = dayItems.filter((i) => i.slot === slot);
                    if (slotItems.length === 0) return null;
                    return (
                      <div key={slot}>
                        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
                          {SLOT_LABELS[slot]}
                        </div>
                        <ul className="space-y-2">
                          {slotItems.map((it) => (
                            <ItineraryItemRow
                              key={it.id}
                              tripId={trip.id}
                              itemId={it.id}
                              title={it.title}
                              notes={it.notes}
                            />
                          ))}
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
