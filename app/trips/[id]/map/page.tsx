import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { placesProvider, eventsProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { centroidFor } from "@/lib/country-centroids";
import { MapView, type MapPin } from "./map-view";
import { KindsPicker } from "./kinds-picker";
import {
  PICKABLE_KINDS,
  PLURAL_TO_PIN,
  PLACES_KINDS,
  type PickableKind,
  type PlacesKind,
} from "./kinds";

// Default: all four place kinds pre-selected so the map is populated
// out of the gate. Events opt-in because it fires a different
// provider + is date-window sensitive.
const DEFAULT_KINDS: PickableKind[] = [
  "attractions",
  "restaurants",
  "cafes",
  "bars",
];

function parseKinds(raw: string | string[] | undefined): PickableKind[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return DEFAULT_KINDS;
  const picked = value
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k): k is PickableKind =>
      (PICKABLE_KINDS as readonly string[]).includes(k),
    );
  return picked.length > 0 ? picked : DEFAULT_KINDS;
}

export default async function TripMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kinds?: string | string[] }>;
}) {
  const { id } = await params;
  const { kinds: kindsParam } = await searchParams;
  const selectedKinds = parseKinds(kindsParam);

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

  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_index, slot, title, notes, address, coords_lat, coords_lng",
    )
    .eq("trip_id", id);

  const resolved = await resolveDestination(trip.destination);
  const center = resolved
    ? { name: resolved.name, lat: resolved.coords.lat, lng: resolved.coords.lng }
    : null;

  // Providers: Places is coord-keyed, events is city + date-window keyed.
  const provider = placesProvider();
  const eProvider = eventsProvider();

  // Fetch each selected category in parallel:
  //  - place kinds hit Google Places at the center/radius
  //  - "events" hits the events provider for the trip's date window
  let contextPins: MapPin[] = [];
  const kindErrors: Array<{ kind: PickableKind; error: string }> = [];
  const placesKinds = selectedKinds.filter((k): k is PlacesKind =>
    (PLACES_KINDS as readonly string[]).includes(k),
  );
  const wantEvents = selectedKinds.includes("events");

  if (center) {
    const tripFromIso = trip.start_date
      ? `${trip.start_date}T00:00:00Z`
      : null;
    const tripToIso = trip.end_date ? `${trip.end_date}T23:59:59Z` : null;

    // Route regional trips (South Italy, Italy-Wide, etc.) through text
    // search so a 50km circle around one anchor city doesn't clip the
    // rest of the region. False negatives are worse than extras here.
    const scope = detectRegionalScope(null, trip.destination);

    const [placeResults, eventsRes] = await Promise.all([
      provider
        ? Promise.all(
            placesKinds.map(async (kind) => {
              const centroid = centroidFor(resolved?.country);
              const directionFilter =
                scope.direction && centroid
                  ? { direction: scope.direction, centroid }
                  : undefined;
              const res = await provider.search({
                center: { lat: center.lat, lng: center.lng },
                kind,
                regional: scope.regional,
                regionQuery: scope.regionQuery,
                countryFilter: resolved?.country ?? undefined,
                directionFilter,
                limit: 20,
              });
              return { kind, res };
            }),
          )
        : Promise.resolve([] as Array<{ kind: PlacesKind; res: never }>),
      wantEvents && eProvider && tripFromIso && tripToIso
        ? eProvider.search({
            city: trip.destination ?? trip.name,
            from: tripFromIso,
            to: tripToIso,
            limit: 30,
          })
        : Promise.resolve(null),
    ]);

    for (const { kind, res } of placeResults) {
      if (res.data) {
        const pinKind = PLURAL_TO_PIN[kind];
        for (const p of res.data) {
          contextPins.push({
            id: `place:${p.id}`,
            title: p.name,
            lat: p.coords.lat,
            lng: p.coords.lng,
            kind: pinKind,
            subtitle:
              p.rating != null
                ? `${p.rating.toFixed(1)}★ · ${p.category.replace(/_/g, " ")}`
                : p.category.replace(/_/g, " "),
          } as MapPin);
        }
      } else if (res.error) {
        kindErrors.push({ kind, error: res.error });
      }
    }

    if (eventsRes) {
      if (eventsRes.data) {
        for (const ev of eventsRes.data) {
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
      } else if (eventsRes.error) {
        kindErrors.push({ kind: "events", error: eventsRes.error });
      }
    }

    // Dedupe by id (a place could match multiple kinds).
    const seen = new Set<string>();
    contextPins = contextPins.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  const itemPins: MapPin[] = (items ?? [])
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

  const clientKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href={`/trips/${trip.id}`}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← {trip.name}
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            Map
          </div>
          <h1 className="font-serif text-3xl">
            {center?.name ?? trip.destination ?? "Somewhere"}
          </h1>
        </div>

        {!clientKey && (
          <div className="card p-6 mb-6">
            <div className="status-est status-error mb-2">
              <span className="status-dot" /> Maps key not configured
            </div>
            <p className="text-sm text-[color:var(--color-fg-2)]">
              Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local and restart.
            </p>
          </div>
        )}

        {clientKey && !center && (
          <div className="card p-6 mb-6">
            <div className="status-est">
              <span className="status-dot" /> Destination coordinates unknown
            </div>
            <p className="text-sm text-[color:var(--color-fg-2)]">
              Couldn&apos;t geocode <em>{trip.destination}</em>. Try a
              more specific destination string.
            </p>
          </div>
        )}

        {clientKey && center && (
          <>
            <KindsPicker initial={selectedKinds} />
            {kindErrors.length > 0 && (
              <div className="card p-3 mb-4 text-xs text-[color:var(--color-warn)]">
                Couldn&apos;t load {kindErrors.map((e) => e.kind).join(", ")}
                {" "}from Google Places. Other categories still shown.
              </div>
            )}
            <MapView
              apiKey={clientKey}
              center={{ lat: center.lat, lng: center.lng }}
              pins={[...contextPins, ...itemPins]}
            />
          </>
        )}
      </main>
    </>
  );
}
