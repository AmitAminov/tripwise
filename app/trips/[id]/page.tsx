import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { InvitePanel } from "./invite-panel";
import { formatDateRange } from "@/lib/format";
import { placesProvider, eventsProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { MapView, type MapPin } from "./map/map-view";
import { KindsPicker } from "./map/kinds-picker";
import {
  PICKABLE_KINDS,
  PLURAL_TO_PIN,
  PLACES_KINDS,
  type PickableKind,
  type PlacesKind,
} from "./map/kinds";

// Map removed — it now lives inline on the right side of this page,
// with the full picker + filter chips baked in.
// Day plan + Decisions were merged into a single "Plan" tile: every
// day of the plan IS a chunk of choices, so the split didn't earn its
// keep. The /decisions route still exists for trip-wide decisions
// that aren't day-scoped (hotel choice, etc.) but is de-emphasized.
const V2_TABS = [
  { slug: "flights", label: "Flights", note: "", ready: true },
  { slug: "attractions", label: "Attractions", note: "", ready: true },
  { slug: "restaurants", label: "Restaurants", note: "", ready: true },
  { slug: "hotels", label: "Hotels", note: "", ready: true },
  { slug: "plan", label: "Plan", note: "day-by-day choices + itinerary", ready: true },
  { slug: "pricing", label: "Prices", note: "aggregated estimates", ready: true },
  { slug: "events", label: "Events", note: "", ready: true },
  { slug: "visuals", label: "Mood", note: "AI generated visuals", ready: true },
] as const;

function parseKinds(raw: string | string[] | undefined): PickableKind[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return ["attractions"];
  const picked = value
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k): k is PickableKind =>
      (PICKABLE_KINDS as readonly string[]).includes(k),
    );
  return picked.length > 0 ? picked : ["attractions"];
}

export default async function TripDetailPage({
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
    .select("id, name, destination, start_date, end_date, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id, joined_at, profiles!inner(display_name, avatar_url)")
    .eq("trip_id", id);

  const { data: activeInvites } = await supabase
    .from("trip_invites")
    .select("token, expires_at")
    .eq("trip_id", id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  const activeInvite = activeInvites?.[0] ?? null;
  const range = formatDateRange(trip.start_date, trip.end_date);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Fetch data for the FULL inline map: destination coords + itinerary
  // pins + every selected picker kind (Places for the four place kinds,
  // events provider for "events") in parallel. Matches the fetch shape
  // of the standalone /trips/[id]/map route so the two stay in sync.
  const [resolvedDest, itemsRes] = await Promise.all([
    resolveDestination(trip.destination),
    supabase
      .from("itinerary_items")
      .select("id, day_index, slot, title, coords_lat, coords_lng")
      .eq("trip_id", trip.id),
  ]);
  const mapCenter = resolvedDest
    ? { lat: resolvedDest.coords.lat, lng: resolvedDest.coords.lng }
    : null;

  const places = placesProvider();
  const eProvider = eventsProvider();

  let contextPins: MapPin[] = [];
  const kindErrors: Array<{ kind: PickableKind; error: string }> = [];
  const placesKinds = selectedKinds.filter((k): k is PlacesKind =>
    (PLACES_KINDS as readonly string[]).includes(k),
  );
  const wantEvents = selectedKinds.includes("events");

  if (mapCenter) {
    const tripFromIso = trip.start_date
      ? `${trip.start_date}T00:00:00Z`
      : null;
    const tripToIso = trip.end_date ? `${trip.end_date}T23:59:59Z` : null;
    const scope = detectRegionalScope(null, trip.destination);

    const [placeResults, eventsRes] = await Promise.all([
      places
        ? Promise.all(
            placesKinds.map(async (kind) => {
              const res = await places.search({
                center: { lat: mapCenter.lat, lng: mapCenter.lng },
                kind,
                regional: scope.regional,
                regionQuery: scope.regionQuery,
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

  const itemPins: MapPin[] = (itemsRes.data ?? [])
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
  const allPins = [...contextPins, ...itemPins];

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href="/trips"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← Back to trips
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="font-serif text-4xl">{trip.name}</h1>
          {trip.destination && (
            <p className="text-lg text-[color:var(--color-fg-2)] mt-1">
              {trip.destination}
            </p>
          )}
          {range && (
            <p className="text-sm text-[color:var(--color-muted)] mt-1">
              {range}
            </p>
          )}
        </div>

        {/*
          Two-column split on desktop:
            LEFT  — Members, Invite, Trip cornerstones
            RIGHT — Sticky inline map (attractions + plan items)
          On mobile everything stacks in source order.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
                Members ({members?.length ?? 0})
              </h2>
              <ul className="flex flex-wrap gap-2">
                {members?.map((m) => {
                  const profile = Array.isArray(m.profiles)
                    ? m.profiles[0]
                    : m.profiles;
                  const name = profile?.display_name ?? "member";
                  const self = m.user_id === user.id;
                  return (
                    <li key={m.user_id} className="chip">
                      {name}
                      {self && (
                        <span className="text-[color:var(--color-muted)]">
                          (you)
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
                Invite
              </h2>
              <InvitePanel
                tripId={trip.id}
                initialToken={activeInvite?.token ?? null}
                siteUrl={siteUrl}
              />
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
                Trip cornerstones
              </h2>
              <ul className="grid grid-cols-2 gap-3">
                {V2_TABS.map((tab) =>
                  tab.ready ? (
                    <li key={tab.slug}>
                      <Link
                        href={`/trips/${trip.id}/${tab.slug}`}
                        className="card block p-4 h-full"
                      >
                        <div className="font-medium mb-1">{tab.label}</div>
                        {tab.note && (
                          <div className="text-xs text-[color:var(--color-muted)]">
                            {tab.note}
                          </div>
                        )}
                        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-accent)] mt-3">
                          Ready →
                        </div>
                      </Link>
                    </li>
                  ) : (
                    <li key={tab.slug}>
                      <div className="card p-4 h-full opacity-60">
                        <div className="font-medium mb-1">{tab.label}</div>
                        {tab.note && (
                          <div className="text-xs text-[color:var(--color-muted)]">
                            {tab.note}
                          </div>
                        )}
                        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-highlight)] mt-3">
                          Coming soon
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
              Map
            </h2>

            {!mapsClientKey && (
              <div className="card p-4 text-sm text-[color:var(--color-fg-2)]">
                Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in
                <code> .env.local</code> to see the map.
              </div>
            )}

            {mapsClientKey && !mapCenter && (
              <div className="card p-4 text-sm text-[color:var(--color-fg-2)]">
                Couldn&apos;t resolve <em>{trip.destination ?? "the destination"}</em>{" "}
                to coordinates yet. Try a more specific name to see it on the map.
              </div>
            )}

            {mapsClientKey && mapCenter && (
              <>
                <KindsPicker initial={selectedKinds} />
                {kindErrors.length > 0 && (
                  <div className="card p-3 mb-4 text-xs text-[color:var(--color-warn)]">
                    Couldn&apos;t load{" "}
                    {kindErrors.map((e) => e.kind).join(", ")} from Google
                    Places. Other categories still shown.
                  </div>
                )}
                <MapView
                  apiKey={mapsClientKey}
                  center={mapCenter}
                  pins={allPins}
                  height={640}
                  showControls
                />
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
