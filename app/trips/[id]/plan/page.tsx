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
import { placesProvider, eventsProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { MapView, type MapPin } from "../map/map-view";
import { EventStrip, type PlanEventItem } from "./event-strip";
import type { EventItem } from "@/lib/providers/types";

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

  // Map preview data: pull destination coords + top attractions in parallel
  // with the per-day leg work so the map ships as part of the page render.
  const [resolvedDest] = await Promise.all([
    resolveDestination(trip.destination),
    Promise.all(
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
          routesUnavailableDays.add(dayIndex);
        }
      }),
    ),
  ]);

  const mapCenter = resolvedDest
    ? { lat: resolvedDest.coords.lat, lng: resolvedDest.coords.lng }
    : null;

  // Context pins from Google Places when available + real events that
  // overlap the trip window. Both run in parallel.
  const places = placesProvider();
  const eProvider = eventsProvider();
  const tripFromIso = trip.start_date
    ? `${trip.start_date}T00:00:00Z`
    : null;
  const tripToIso = trip.end_date ? `${trip.end_date}T23:59:59Z` : null;

  const [placesResult, eventsResult] = await Promise.all([
    places && mapCenter
      ? places.search({
          center: mapCenter,
          kind: "attractions",
          radiusMeters: 4000,
          limit: 10,
        })
      : Promise.resolve(null),
    eProvider && tripFromIso && tripToIso
      ? eProvider.search({
          city: trip.destination ?? trip.name,
          from: tripFromIso,
          to: tripToIso,
          limit: 40,
        })
      : Promise.resolve(null),
  ]);

  // Group events by day-index within the trip window so each day card can
  // surface its own "What's on" strip. Uses the trip's start_date as
  // anchor (UTC) to compute the day slot the event falls in.
  const eventsByDay = new Map<number, PlanEventItem[]>();
  if (eventsResult?.data && trip.start_date) {
    const anchor = new Date(`${trip.start_date}T00:00:00Z`).getTime();
    for (const ev of eventsResult.data as EventItem[]) {
      const t = new Date(ev.startAt).getTime();
      if (!Number.isFinite(t)) continue;
      const di = Math.floor((t - anchor) / 86400_000);
      if (di < 0 || di >= totalDays) continue;
      const arr = eventsByDay.get(di) ?? [];
      arr.push({
        id: ev.id,
        name: ev.name,
        startAt: ev.startAt,
        venueName: ev.venueName,
        coordsLat: ev.coords?.lat,
        coordsLng: ev.coords?.lng,
        ticketUrl: ev.ticketUrl,
        categories: ev.categories,
      });
      eventsByDay.set(di, arr);
    }
    // Sort each day's list chronologically, cap at 4 per day so the card
    // stays scannable — the map + /trips/[id]/events show the full set.
    for (const [di, list] of eventsByDay) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
      if (list.length > 4) eventsByDay.set(di, list.slice(0, 4));
    }
  }

  let contextPins: MapPin[] = [];
  if (placesResult?.data) {
    contextPins = placesResult.data.map((p) => ({
      id: `place:${p.id}`,
      title: p.name,
      lat: p.coords.lat,
      lng: p.coords.lng,
      kind: "attraction" as const,
      subtitle:
        p.rating != null
          ? `${p.rating.toFixed(1)}★ · ${p.category.replace(/_/g, " ")}`
          : p.category.replace(/_/g, " "),
    }));
  }
  // Only pin events that came back with coordinates (many curated /
  // aggregate entries lack a specific venue lat/lng).
  if (eventsResult?.data) {
    for (const ev of eventsResult.data) {
      if (!ev.coords) continue;
      const day = ev.startAt.slice(0, 10);
      const time = ev.startAt.slice(11, 16);
      contextPins.push({
        id: `event:${ev.id}`,
        title: ev.name,
        lat: ev.coords.lat,
        lng: ev.coords.lng,
        kind: "event" as const,
        subtitle: `${day} ${time}${ev.venueName ? " · " + ev.venueName : ""}`,
      });
    }
  }

  const itemPins: MapPin[] = items
    .filter((i) => i.coords_lat != null && i.coords_lng != null)
    .map((i) => ({
      id: `item:${i.id}`,
      title: i.title,
      subtitle: `Day ${i.day_index + 1} · ${i.slot}`,
      lat: i.coords_lat!,
      lng: i.coords_lng!,
      kind: "plan" as const,
      dayIndex: i.day_index,
    }));

  const mapsClientKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  // "Open in Google Maps" — build a directions URL with waypoints so tapping
  // it on a phone opens the native Maps app pre-populated with the plan.
  // Google Maps directions API supports up to 10 waypoints in a URL.
  function googleMapsDirUrl(pts: { lat: number; lng: number }[]): string | null {
    if (pts.length < 2) return null;
    const slice = pts.slice(0, 10);
    const origin = `${slice[0].lat},${slice[0].lng}`;
    const destination = `${slice[slice.length - 1].lat},${slice[slice.length - 1].lng}`;
    const waypoints = slice
      .slice(1, -1)
      .map((p) => `${p.lat},${p.lng}`)
      .join("|");
    const params = new URLSearchParams({
      api: "1",
      origin,
      destination,
      travelmode: "walking",
    });
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const allDayPts = items
    .filter((i) => i.coords_lat != null && i.coords_lng != null)
    .map((i) => ({ lat: i.coords_lat!, lng: i.coords_lng! }));
  const dirUrl = googleMapsDirUrl(allDayPts);

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
          <div className="flex items-center gap-2 shrink-0">
            {dirUrl && (
              <a
                href={dirUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost text-xs"
                title="Open your plan waypoints in Google Maps (walking directions)"
              >
                Open in Google Maps →
              </a>
            )}
            <CalendarExportButton tripId={trip.id} />
          </div>
        </div>

        {mapsClientKey && mapCenter && (contextPins.length + itemPins.length > 0) && (
          <div className="mb-6">
            <MapView
              apiKey={mapsClientKey}
              center={mapCenter}
              pins={[...contextPins, ...itemPins]}
              height={320}
              showControls={false}
            />
            <div className="mt-2 text-xs text-[color:var(--color-muted)] flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#c9a961" }}
                />
                Nearby attractions
              </span>
              {contextPins.some((p) => p.kind === "event") && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#3a5f9e" }}
                  />
                  Live events during your trip
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#2d5f4e" }}
                />
                Your plan items
              </span>
              <Link
                href={`/trips/${trip.id}/map`}
                className="text-[color:var(--color-primary)] hover:underline ml-auto"
              >
                Full map + filters →
              </Link>
            </div>
          </div>
        )}

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

                <EventStrip
                  tripId={trip.id}
                  dayIndex={dayIndex}
                  events={eventsByDay.get(dayIndex) ?? []}
                  addedTitles={
                    new Set(dayItems.map((i) => i.title.toLowerCase()))
                  }
                />

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
