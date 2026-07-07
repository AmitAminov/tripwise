import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { placesProvider } from "@/lib/providers";
import { resolveDestination } from "@/lib/destination-coords";
import { detectRegionalScope } from "@/lib/destination-scope";
import type { Place, PlaceSearchQuery } from "@/lib/providers/types";

/**
 * Dedicated Restaurants cornerstone.
 *
 * Layout: four side-by-side columns.
 *   TOP                — cross-category highlights (best of the three
 *                        below, ranked by rating × log(reviews)).
 *   RESTAURANT         — Places kind=restaurants (excludes hotels).
 *   CAFÉ & PATISSERIE  — Places kind=patisseries (cafe, coffee_shop,
 *                        bakery, dessert_shop, merged).
 *   WINERY             — Places kind=wineries (winery, wine_bar).
 *
 * Each column shows up to 8 cards.
 *
 * Why a dedicated route (not attractions?kind=restaurants)? The old
 * URL was returning both restaurants AND hotels because Places
 * text-search-in-region falls back to broader semantics for regional
 * trips. This route filters hotels post-fetch and adds patisseries
 * + wineries which weren't reachable via the old shared page.
 */

// Anything Places tags as one of these gets dropped from a food/drink
// column — hotels have their own cornerstone. Includes lodging plus
// the sub-types Places uses for specific accommodation shapes.
const HOTEL_LIKE_TYPES = new Set([
  "lodging",
  "hotel",
  "resort_hotel",
  "extended_stay_hotel",
  "motel",
  "hostel",
  "bed_and_breakfast",
  "guest_house",
  "inn",
  "campground",
  "rv_park",
]);

/** Drop places whose types intersect the hotel-like set. */
function stripHotels(places: Place[]): Place[] {
  return places.filter(
    (p) => !p.category || !HOTEL_LIKE_TYPES.has(p.category),
  );
}

/**
 * Score for the TOP column merge. Google's ordering already
 * approximates this on the wire, but merging across kinds needs an
 * explicit tiebreak so a 4.7★ (200) restaurant beats a 4.9★ (3) café.
 */
function score(p: Place): number {
  const r = p.rating ?? 3.5;
  const c = p.ratingCount ?? 0;
  return r * Math.log(c + 10);
}

interface Column {
  key: "top" | "restaurant" | "patisserie" | "winery";
  label: string;
  places: Place[];
  live: boolean;
  error?: string;
}

export default async function RestaurantsPage({
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
    .select("id, name, destination")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const resolved = await resolveDestination(trip.destination);
  const center = resolved
    ? { name: resolved.name, lat: resolved.coords.lat, lng: resolved.coords.lng }
    : null;
  const provider = placesProvider();

  // Three parallel Places calls, one per category, then compute the
  // Top column locally. When the trip is regional (South Italy, etc.)
  // detectRegionalScope routes each of them through searchText so we
  // don't miss picks outside a 50km circle around the anchor city.
  const scope = detectRegionalScope(null, trip.destination);
  const baseQuery = (
    kind: PlaceSearchQuery["kind"],
  ): PlaceSearchQuery | null => {
    if (!center) return null;
    return {
      center: { lat: center.lat, lng: center.lng },
      kind,
      regional: scope.regional,
      regionQuery: scope.regionQuery,
      countryFilter: resolved?.country ?? undefined,
      limit: 20,
    };
  };

  const restaurantsCol: Column = {
    key: "restaurant",
    label: "Restaurant",
    places: [],
    live: false,
  };
  const patisserieCol: Column = {
    key: "patisserie",
    label: "Café & Patisserie",
    places: [],
    live: false,
  };
  const wineryCol: Column = {
    key: "winery",
    label: "Winery",
    places: [],
    live: false,
  };

  if (provider && center) {
    const [restsRes, patisRes, wineRes] = await Promise.all([
      provider.search(baseQuery("restaurants")!),
      provider.search(baseQuery("patisseries")!),
      provider.search(baseQuery("wineries")!),
    ]);

    if (restsRes.data) {
      restaurantsCol.places = stripHotels(restsRes.data).slice(0, 8);
      restaurantsCol.live = true;
    } else if (restsRes.error) restaurantsCol.error = restsRes.error;

    if (patisRes.data) {
      patisserieCol.places = stripHotels(patisRes.data).slice(0, 8);
      patisserieCol.live = true;
    } else if (patisRes.error) patisserieCol.error = patisRes.error;

    if (wineRes.data) {
      wineryCol.places = stripHotels(wineRes.data).slice(0, 8);
      wineryCol.live = true;
    } else if (wineRes.error) wineryCol.error = wineRes.error;
  }

  // Merge for the TOP column. Dedupe by place id so a spot that
  // Google returned under both "restaurant" and "patisserie" doesn't
  // occupy two rank slots.
  const merged = new Map<string, Place>();
  for (const p of [
    ...restaurantsCol.places,
    ...patisserieCol.places,
    ...wineryCol.places,
  ]) {
    if (!merged.has(p.id)) merged.set(p.id, p);
  }
  const topPlaces = Array.from(merged.values())
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8);
  const topCol: Column = {
    key: "top",
    label: "Top",
    places: topPlaces,
    live: topPlaces.length > 0,
  };

  const columns: Column[] = [topCol, restaurantsCol, patisserieCol, wineryCol];
  const anyLive = columns.some((c) => c.live);

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href={`/trips/${trip.id}`}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← {trip.name}
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            Yummy
          </div>
          <h1 className="font-serif text-4xl">
            {center?.name ?? trip.destination ?? "Somewhere"}
          </h1>
        </div>

        {!provider && (
          <ProviderStatusCard
            title="Provider not configured"
            body="Set GOOGLE_MAPS_API_KEY in .env.local and restart the dev server."
          />
        )}

        {provider && !center && (
          <ProviderStatusCard
            title="Destination coordinates unknown"
            body={
              <>
                Couldn&apos;t resolve <em>{trip.destination}</em> via
                seed data or Google Geocoding. Try a more specific name
                (e.g. &quot;Prague, Czech Republic&quot;).
              </>
            }
          />
        )}

        {provider && center && !anyLive && (
          <ProviderStatusCard
            title="No places returned"
            body="Google Places didn't return any picks for this destination in any of the categories. Check that Places API (New) is enabled + the key isn't referrer-restricted for the server side."
          />
        )}

        {provider && center && anyLive && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {columns.map((col, i) => (
              <ColumnCard
                key={col.key}
                col={col}
                isLast={i === columns.length - 1}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function ColumnCard({ col, isLast }: { col: Column; isLast: boolean }) {
  return (
    <section
      aria-labelledby={`col-${col.key}`}
      // Vertical separators between columns at the lg breakpoint where
      // we're actually 4-across. Below that we stack, so no divider.
      // Padding balances the border so cards don't hug it.
      className={
        "min-w-0" +
        (isLast
          ? " lg:pl-4"
          : " lg:pl-4 lg:pr-4 lg:border-r lg:border-[color:var(--color-line)]") +
        " md:pb-6"
      }
    >
      {/*
        Sticky column header — stays pinned to the viewport top as the
        user scrolls through a long list. Background matches page bg
        so cards scrolling underneath don't bleed through. z-10 stays
        above the cards.
      */}
      <div className="sticky top-0 z-10 bg-[color:var(--color-bg)] pt-4 pb-3 mb-3 border-b border-[color:var(--color-line)] flex items-baseline justify-between gap-2">
        <h2
          id={`col-${col.key}`}
          className="font-serif text-xl leading-none"
        >
          {col.label}
        </h2>
        {col.places.length > 0 && (
          <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] tabular-nums">
            {col.places.length}
          </span>
        )}
      </div>

      {col.error && (
        <div className="text-xs text-[color:var(--color-warn)] mb-2">
          Places error — {col.error.slice(0, 100)}
        </div>
      )}

      {col.places.length === 0 && !col.error && (
        <p className="text-xs text-[color:var(--color-muted)] italic">
          No picks for this category near the destination.
        </p>
      )}

      <ul className="space-y-3">
        {col.places.map((p) => (
          <li key={p.id}>
            <PlaceCard place={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaceCard({ place: p }: { place: Place }) {
  return (
    <article className="card overflow-hidden">
      {p.photoUrl ? (
        <div className="relative h-28 bg-[color:var(--color-surface-2)]">
          <Image
            src={p.photoUrl}
            alt={p.name}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 640px) 100vw, 25vw"
          />
        </div>
      ) : (
        <div className="h-16 bg-gradient-to-br from-[color:var(--color-surface-2)] to-[color:var(--color-line)]" />
      )}
      <div className="p-3">
        <div className="font-medium text-sm truncate" title={p.name}>
          {p.name}
        </div>
        {p.category && (
          <div className="text-[10px] text-[color:var(--color-muted)] capitalize mt-0.5">
            {p.category.replace(/_/g, " ")}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs">
          {typeof p.rating === "number" && (
            <span className="tabular-nums">
              ★ {p.rating.toFixed(1)}
              {p.ratingCount ? (
                <span className="text-[color:var(--color-muted)]">
                  {" "}
                  ({p.ratingCount.toLocaleString()})
                </span>
              ) : null}
            </span>
          )}
          {typeof p.priceLevel === "number" && p.priceLevel > 0 && (
            <span className="text-[color:var(--color-muted)]">
              {"$".repeat(p.priceLevel)}
            </span>
          )}
        </div>
        {p.address && (
          <div className="text-[11px] text-[color:var(--color-muted)] mt-1 truncate">
            {p.address}
          </div>
        )}
      </div>
    </article>
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
