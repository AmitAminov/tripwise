import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { placesProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import { SendToArenaButton } from "@/components/send-to-arena-button";

function firstStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AttractionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const kind = ((firstStr(sp.kind) ?? "attractions") as
    | "attractions"
    | "restaurants"
    | "cafes"
    | "bars");
  const resolved = await resolveDestination(trip.destination);
  const coords = resolved
    ? { name: resolved.name, lat: resolved.coords.lat, lng: resolved.coords.lng }
    : null;
  const provider = placesProvider();

  let result: Awaited<
    ReturnType<NonNullable<ReturnType<typeof placesProvider>>["search"]>
  > | null = null;
  if (provider && coords) {
    const scope = detectRegionalScope(null, trip.destination);
    result = await provider.search({
      center: { lat: coords.lat, lng: coords.lng },
      kind,
      regional: scope.regional,
      regionQuery: scope.regionQuery,
      limit: 20,
    });
  }

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-5xl mx-auto p-6">
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
            {kind === "attractions"
              ? "Attractions"
              : kind === "restaurants"
                ? "Restaurants"
                : kind === "cafes"
                  ? "Cafés"
                  : "Bars"}
          </div>
          <h1 className="font-serif text-3xl">
            {coords?.name ?? trip.destination ?? "Somewhere"}
          </h1>
        </div>

        {/* Kind filter tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(["attractions", "restaurants", "cafes", "bars"] as const).map(
            (k) => (
              <Link
                key={k}
                href={`/trips/${trip.id}/attractions?kind=${k}`}
                className="chip capitalize"
                data-selected={kind === k}
              >
                {k}
              </Link>
            ),
          )}
        </div>

        {!provider && (
          <ProviderStatusCard
            title="Provider not configured"
            body="Set GOOGLE_MAPS_API_KEY in .env.local and restart the dev server."
          />
        )}

        {provider && !coords && (
          <ProviderStatusCard
            title="Destination coordinates unknown"
            body={
              <>
                Couldn&apos;t resolve <em>{trip.destination}</em> via
                seed data or Google Geocoding. Try a more specific name
                (e.g. &quot;Prague, Czech Republic&quot;) or check that
                the Geocoding API is enabled on your Cloud project.
              </>
            }
          />
        )}

        {result?.status === "error" && (
          <ProviderStatusCard
            title="Places API error"
            body={
              <>
                {result.error}
                <br />
                <br />
                Most common cause: <strong>Places API (New)</strong> not
                enabled on your Google Cloud project, or the API key has
                restrictions that block it.{" "}
                <a
                  href="https://console.developers.google.com/apis/api/places.googleapis.com/overview"
                  className="text-[color:var(--color-primary)] underline"
                >
                  Enable Places API (New) →
                </a>
              </>
            }
          />
        )}

        {result?.status === "live_checked" &&
          result.data &&
          result.data.length >= 2 && (
            <div className="mb-4">
              <SendToArenaButton
                tripId={trip.id}
                seed={{
                  title:
                    kind === "restaurants"
                      ? `Where to eat in ${coords?.name ?? trip.destination ?? trip.name}?`
                      : kind === "cafes"
                        ? `Which café in ${coords?.name ?? trip.destination ?? trip.name}?`
                        : kind === "bars"
                          ? `Which bar in ${coords?.name ?? trip.destination ?? trip.name}?`
                          : `Which attraction to prioritize in ${coords?.name ?? trip.destination ?? trip.name}?`,
                  category:
                    kind === "restaurants" || kind === "cafes" || kind === "bars"
                      ? "food"
                      : "activity",
                  options: result.data.slice(0, 6).map((p) => ({
                    label: p.name,
                    notes: p.rating
                      ? `${p.rating.toFixed(1)}★${p.address ? " · " + p.address : ""}`
                      : (p.address ?? undefined),
                  })),
                }}
                label={`Compare top ${Math.min(6, result.data.length)} in arena →`}
                className="btn btn-accent text-xs"
              />
            </div>
          )}

        {result?.status === "live_checked" && result.data && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map((p) => (
              <li key={p.id} className="card overflow-hidden">
                {p.photoUrl ? (
                  <div className="relative h-40 bg-[color:var(--color-surface-2)]">
                    <Image
                      src={p.photoUrl}
                      alt={p.name}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-[color:var(--color-surface-2)] to-[color:var(--color-line)]" />
                )}
                <div className="p-4">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-[color:var(--color-muted)] capitalize mt-0.5">
                    {p.category.replace(/_/g, " ")}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {typeof p.rating === "number" && (
                      <span>
                        ★ {p.rating.toFixed(1)}
                        {p.ratingCount && (
                          <span className="text-[color:var(--color-muted)]">
                            {" "}
                            ({p.ratingCount.toLocaleString()})
                          </span>
                        )}
                      </span>
                    )}
                    {typeof p.priceLevel === "number" && p.priceLevel > 0 && (
                      <span className="text-[color:var(--color-muted)]">
                        {"$".repeat(p.priceLevel)}
                      </span>
                    )}
                  </div>
                  {p.address && (
                    <div className="text-xs text-[color:var(--color-muted)] mt-1 truncate">
                      {p.address}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function ProviderStatusCard({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="status-est status-error mb-2">
        <span className="status-dot" /> {title}
      </div>
      <p className="text-sm text-[color:var(--color-fg-2)]">{body}</p>
    </div>
  );
}
