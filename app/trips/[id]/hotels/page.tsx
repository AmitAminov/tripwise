import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { hotelProvider } from "@/lib/providers";
import {
  buildAirbnbUrl,
  buildBookingUrl,
  buildHostelworldUrl,
} from "@/lib/providers/hotels/deep-links";
import { formatUSD } from "@/lib/format";

const COMFORT_LEVELS = [
  { value: "budget", label: "Budget" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
] as const;

function firstStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function nightsBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 7;
  const diff = Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (86400 * 1000),
  );
  return Math.max(1, Math.min(60, diff));
}

export default async function HotelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const comfort =
    (firstStr(sp.comfort) as
      | "budget"
      | "standard"
      | "premium"
      | "luxury"
      | undefined) ?? "standard";
  const guests = Math.max(1, Math.min(10, Number(firstStr(sp.guests) ?? 2)));

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

  const destination = trip.destination ?? trip.name;
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const provider = hotelProvider();
  const result = provider
    ? await provider.estimate({
        destination,
        nights,
        comfortLevel: comfort,
        guests,
      })
    : null;

  const bookingUrl = buildBookingUrl(
    destination,
    trip.start_date,
    trip.end_date,
    guests,
  );
  const airbnbUrl = buildAirbnbUrl(
    destination,
    trip.start_date,
    trip.end_date,
    guests,
  );
  const hostelworldUrl = buildHostelworldUrl(destination);

  const estimate = result?.data;
  const perNightExpected = estimate?.perNight.expected ?? 0;
  const totalExpected = perNightExpected * nights;

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

        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            Hotels
          </div>
          <h1 className="font-serif text-3xl">Where to stay in {destination}</h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            {nights} night{nights === 1 ? "" : "s"} · {guests} guest
            {guests === 1 ? "" : "s"} ·{" "}
            <span className="status-est inline-flex">
              <span className="status-dot" /> Estimated
            </span>
          </p>
        </div>

        {/* Comfort tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {COMFORT_LEVELS.map((c) => (
            <Link
              key={c.value}
              href={`/trips/${trip.id}/hotels?comfort=${c.value}&guests=${guests}`}
              className="chip"
              data-selected={comfort === c.value}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* Estimate summary */}
        {estimate && (
          <div className="card p-5 mb-8">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-serif text-xl">
                {comfort.charAt(0).toUpperCase() + comfort.slice(1)} estimate
              </h2>
              <div className="text-right">
                <div className="text-2xl font-serif text-[color:var(--color-primary)]">
                  {formatUSD(totalExpected)}
                </div>
                <div className="text-xs text-[color:var(--color-muted)]">
                  total · {nights} nights
                </div>
              </div>
            </div>
            <div className="text-sm text-[color:var(--color-fg-2)]">
              {formatUSD(estimate.perNight.min)} –{" "}
              {formatUSD(estimate.perNight.max)} per night · avg{" "}
              {formatUSD(estimate.perNight.expected)}
            </div>
          </div>
        )}

        {/* Areas */}
        {estimate?.areas && estimate.areas.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
              Best areas
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {estimate.areas.map((area) => (
                <div key={area.name} className="card p-4">
                  <div className="font-medium mb-1">{area.name}</div>
                  <p className="text-sm text-[color:var(--color-fg-2)] mb-2">
                    {area.vibe}
                  </p>
                  <div className="text-sm">
                    {formatUSD(area.perNight.min)} –{" "}
                    {formatUSD(area.perNight.max)}
                    <span className="text-[color:var(--color-muted)] text-xs ml-2">
                      /night avg
                    </span>
                  </div>
                  {area.walkableTo && area.walkableTo.length > 0 && (
                    <div className="mt-3 text-xs text-[color:var(--color-muted)]">
                      Walk to: {area.walkableTo.join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Booking deep links */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
            Search on
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="card p-4"
            >
              <div className="font-medium">Booking.com</div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">
                Pre-filled: destination, dates, guests
              </div>
              <div className="text-xs text-[color:var(--color-primary)] mt-3">
                Open →
              </div>
            </a>
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="card p-4"
            >
              <div className="font-medium">Airbnb</div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">
                Full apartments, longer stays
              </div>
              <div className="text-xs text-[color:var(--color-primary)] mt-3">
                Open →
              </div>
            </a>
            <a
              href={hostelworldUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="card p-4"
            >
              <div className="font-medium">Hostelworld</div>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">
                Budget beds + private rooms
              </div>
              <div className="text-xs text-[color:var(--color-primary)] mt-3">
                Open →
              </div>
            </a>
          </div>
          <p className="text-xs text-[color:var(--color-muted)] mt-4">
            We don&apos;t scrape hotel inventory — the buttons above open
            each provider&apos;s own search with your trip details pre-filled.
            Real inventory API arrives when you connect LiteAPI or RateHawk.
          </p>
        </section>
      </main>
    </>
  );
}
