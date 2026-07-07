/**
 * POST /api/calendar/export
 * body: { tripId: string, accessToken: string }
 *
 * Takes a short-lived Google access token (from GIS OAuth popup) and
 * inserts every itinerary_items row of a trip into the caller's primary
 * Google Calendar.
 *
 * We use the SUPABASE session to authorize the read of the trip's data
 * (RLS gates it — non-members get nothing) and the GOOGLE access token
 * only for the Calendar write. This means we never see the user's Google
 * refresh token — the tab losing focus just means they re-consent later.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Slot = "morning" | "afternoon" | "evening" | "any";

const SLOT_DEFAULTS: Record<Slot, { hour: number; durationHours: number }> = {
  morning: { hour: 9, durationHours: 2 },
  afternoon: { hour: 13, durationHours: 3 },
  evening: { hour: 19, durationHours: 2 },
  any: { hour: 12, durationHours: 1 },
};

function isSlot(v: string): v is Slot {
  return ["morning", "afternoon", "evening", "any"].includes(v);
}

function offsetDate(startDate: string, dayIndex: number): Date {
  const d = new Date(startDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d;
}

function iso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

export async function POST(request: NextRequest) {
  let body: { tripId?: unknown; accessToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const tripId = typeof body.tripId === "string" ? body.tripId : null;
  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken : null;
  if (!tripId || !accessToken) {
    return NextResponse.json(
      { error: "tripId and accessToken required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_index, slot, position, title, notes, address, starts_at, ends_at",
    )
    .eq("trip_id", tripId)
    .order("day_index", { ascending: true })
    .order("slot", { ascending: true })
    .order("position", { ascending: true });

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "This trip has no itinerary items yet." },
      { status: 400 },
    );
  }
  if (!trip.start_date) {
    return NextResponse.json(
      { error: "Set the trip start date first — Calendar needs anchor dates." },
      { status: 400 },
    );
  }

  // Build events with sane defaults per slot; explicit starts_at overrides.
  const events: CalendarEvent[] = items.map((it) => {
    const slot: Slot = isSlot(it.slot) ? it.slot : "any";
    let startISO: string;
    let endISO: string;
    const parsedStart = it.starts_at ? new Date(it.starts_at) : null;
    const startValid =
      parsedStart !== null && Number.isFinite(parsedStart.getTime());
    if (startValid && parsedStart) {
      startISO = it.starts_at as string;
      const parsedEnd = it.ends_at ? new Date(it.ends_at) : null;
      const endValid =
        parsedEnd !== null && Number.isFinite(parsedEnd.getTime());
      endISO =
        endValid && parsedEnd
          ? (it.ends_at as string)
          : iso(new Date(parsedStart.getTime() + 60 * 60 * 1000));
    } else {
      // Fallback: slot-based defaults anchored on the trip's start_date.
      // Also the safe path when a row has a bad ISO in starts_at that
      // would otherwise throw RangeError when passed to .toISOString().
      const dayDate = offsetDate(trip.start_date!, it.day_index);
      const defs = SLOT_DEFAULTS[slot];
      dayDate.setUTCHours(defs.hour, 0, 0, 0);
      startISO = iso(dayDate);
      const endDate = new Date(
        dayDate.getTime() + defs.durationHours * 60 * 60 * 1000,
      );
      endISO = iso(endDate);
    }
    return {
      summary: it.title,
      description:
        (it.notes ?? "") +
        (it.notes ? "\n\n" : "") +
        `TripWise: ${trip.name}${trip.destination ? " · " + trip.destination : ""}`,
      location: it.address ?? trip.destination ?? undefined,
      start: { dateTime: startISO },
      end: { dateTime: endISO },
    };
  });

  // Google Calendar API only supports one insert per request in v3.
  // Fire in parallel up to a modest concurrency ceiling.
  const CONCURRENCY = 4;
  const results: Array<
    | { ok: true; id: string }
    | { ok: false; title: string; error: string }
  > = [];

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (ev): Promise<(typeof results)[number]> => {
        try {
          const res = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(ev),
              signal: AbortSignal.timeout(8_000),
            },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return {
              ok: false,
              title: ev.summary,
              error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
            };
          }
          const json = (await res.json()) as { id?: string };
          return { ok: true, id: json.id ?? "" };
        } catch (e) {
          return {
            ok: false,
            title: ev.summary,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );
    results.push(...batchResults);
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r): r is Exclude<typeof results[number], { ok: true; id: string }> => !r.ok);

  return NextResponse.json({
    total: events.length,
    succeeded,
    failed: failed.map((f) => ({ title: f.title, error: f.error })),
  });
}
