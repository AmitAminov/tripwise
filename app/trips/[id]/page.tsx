import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { InvitePanel } from "./invite-panel";
import { formatDateRange } from "@/lib/format";
import { placesProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { MapView, type MapPin } from "./map/map-view";

// Map removed — it now lives inline on the right side of this page.
const V2_TABS = [
  { slug: "flights", label: "Flights", note: "real prices, converted to USD", ready: true },
  { slug: "attractions", label: "Attractions", note: "Google Places (New)", ready: true },
  { slug: "attractions?kind=restaurants", label: "Restaurants", note: "Google Places (New)", ready: true },
  { slug: "hotels", label: "Hotels", note: "estimates + deep links", ready: true },
  { slug: "plan", label: "Day plan", note: "day-by-day itinerary", ready: true },
  { slug: "pricing", label: "Prices", note: "aggregated estimates", ready: true },
  { slug: "events", label: "Events", note: "curated + Ticketmaster (opt.)", ready: true },
  { slug: "visuals", label: "Mood", note: "AI generated visuals", ready: true },
  { slug: "decisions", label: "Decisions", note: "the reveal mechanic", ready: true },
] as const;

export default async function TripDetailPage({
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

  // Fetch data for the inline map: destination coords + itinerary pins +
  // top attractions in one round-trip. Same pattern as /trips/[id]/map
  // uses, but scoped down to a preview (attractions only; kinds picker
  // lives on the full-map route the "Filters + full map" link points at).
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
  let contextPins: MapPin[] = [];
  if (places && mapCenter) {
    const scope = detectRegionalScope(null, trip.destination);
    const res = await places.search({
      center: mapCenter,
      kind: "attractions",
      regional: scope.regional,
      regionQuery: scope.regionQuery,
      limit: 20,
    });
    if (res.data) {
      contextPins = res.data.map((p) => ({
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
  const hasPins = allPins.length > 0;

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
                        <div className="text-xs text-[color:var(--color-muted)]">
                          {tab.note}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-accent)] mt-3">
                          Ready →
                        </div>
                      </Link>
                    </li>
                  ) : (
                    <li key={tab.slug}>
                      <div className="card p-4 h-full opacity-60">
                        <div className="font-medium mb-1">{tab.label}</div>
                        <div className="text-xs text-[color:var(--color-muted)]">
                          {tab.note}
                        </div>
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
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)]">
                Map
              </h2>
              <Link
                href={`/trips/${trip.id}/map`}
                className="text-xs text-[color:var(--color-primary)] hover:underline"
                title="Toggle categories (restaurants, cafés, bars, events), pan the whole region"
              >
                Full map + filters →
              </Link>
            </div>

            {!mapsClientKey && (
              <div className="card p-4 text-sm text-[color:var(--color-fg-2)]">
                Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in
                <code> .env.local</code> to see the inline map.
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
                <MapView
                  apiKey={mapsClientKey}
                  center={mapCenter}
                  pins={allPins}
                  height={640}
                  showControls={false}
                />
                <div className="mt-3 text-xs text-[color:var(--color-muted)] flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: "#c9a961" }}
                    />
                    Nearby attractions
                    <span className="tabular-nums opacity-70">
                      ({contextPins.length})
                    </span>
                  </span>
                  {itemPins.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#2d5f4e" }}
                      />
                      Your plan items
                      <span className="tabular-nums opacity-70">
                        ({itemPins.length})
                      </span>
                    </span>
                  )}
                  {!hasPins && (
                    <span>
                      No pins yet — add itinerary items or expand the search on
                      the full map.
                    </span>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
