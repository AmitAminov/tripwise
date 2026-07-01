import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { getDestination, DESTINATIONS } from "@/data/destinations";
import { placesProvider } from "@/lib/providers";
import { MapView, type MapPin } from "./map-view";

function resolveCoords(
  destination: string | null,
): { name: string; lat: number; lng: number } | null {
  if (!destination) return null;
  const lower = destination.toLowerCase();
  for (const d of DESTINATIONS) {
    if (
      lower.includes(d.name.toLowerCase()) ||
      (d.id === "south_italy" &&
        /naples|napoli|amalfi|positano|puglia/i.test(lower))
    ) {
      return { name: d.name, lat: d.coords.lat, lng: d.coords.lng };
    }
  }
  return null;
}

export default async function TripMapPage({
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

  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      "id, day_index, slot, title, notes, address, coords_lat, coords_lng",
    )
    .eq("trip_id", id);

  const center = resolveCoords(trip.destination);

  // Enrich pins: for items without coords, look up nearby Places.
  const provider = placesProvider();

  // Also grab the top attractions to always show as context pins.
  let contextPins: MapPin[] = [];
  if (provider && center) {
    const result = await provider.search({
      center: { lat: center.lat, lng: center.lng },
      kind: "attractions",
      radiusMeters: 4000,
      limit: 12,
    });
    if (result.data) {
      contextPins = result.data.map((p) => ({
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
              Set the trip destination to Bangkok, Prague, or South Italy.
              Geocoding for arbitrary cities lands next.
            </p>
          </div>
        )}

        {clientKey && center && (
          <MapView
            apiKey={clientKey}
            center={{ lat: center.lat, lng: center.lng }}
            pins={[...contextPins, ...itemPins]}
          />
        )}
      </main>
    </>
  );
}
