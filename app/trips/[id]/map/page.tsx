import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { placesProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { MapView, type MapPin } from "./map-view";
import { KindsPicker } from "./kinds-picker";
import { PICKABLE_KINDS, PLURAL_TO_PIN, type PickableKind } from "./kinds";

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

  // Enrich pins: for items without coords, look up nearby Places.
  const provider = placesProvider();

  // Fetch each selected category in parallel; pin the results with their
  // singular MapPin kind so the MapView can color and filter them.
  let contextPins: MapPin[] = [];
  const kindErrors: Array<{ kind: PickableKind; error: string }> = [];
  if (provider && center) {
    const results = await Promise.all(
      selectedKinds.map(async (kind) => {
        const res = await provider.search({
          center: { lat: center.lat, lng: center.lng },
          kind,
          radiusMeters: 4000,
          limit: 12,
        });
        return { kind, res };
      }),
    );
    for (const { kind, res } of results) {
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
