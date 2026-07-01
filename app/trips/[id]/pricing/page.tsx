import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { getDestination, DESTINATIONS } from "@/data/destinations";
import { flightProvider, hotelProvider } from "@/lib/providers";
import { formatUSD } from "@/lib/format";
import type { PriceEstimate } from "@/lib/types/trip-intent";

type Comfort = "budget" | "standard" | "premium" | "luxury";

const COMFORT_MULT: Record<Comfort, number> = {
  budget: 0.6,
  standard: 1.0,
  premium: 1.6,
  luxury: 2.5,
};

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

function resolveDestination(destinationText: string | null) {
  if (!destinationText) return null;
  const lower = destinationText.toLowerCase();
  return (
    DESTINATIONS.find(
      (d) =>
        lower.includes(d.name.toLowerCase()) ||
        (d.id === "south_italy" &&
          /naples|napoli|amalfi|positano|puglia|italy/i.test(lower)),
    ) ?? null
  );
}

function scale(
  est: { min: number; expected: number; max: number },
  mult: number,
) {
  return {
    min: Math.round(est.min * mult),
    expected: Math.round(est.expected * mult),
    max: Math.round(est.max * mult),
  };
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const comfort: Comfort =
    (firstStr(sp.comfort) as Comfort) ?? "standard";
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
  const seed = resolveDestination(destination);
  const mult = COMFORT_MULT[comfort];

  // Try to get a live flight price. Non-blocking; on error use the seed.
  let liveFlightUSD: number | null = null;
  let flightSource: "live" | "estimated" = "estimated";
  const provider = flightProvider();
  if (seed && trip.start_date) {
    try {
      const res = await provider.search({
        originAirport: "TLV",
        destinationAirport: seed.airport,
        departDate: trip.start_date,
        returnDate: trip.end_date ?? undefined,
        adults: guests,
        cabinClass: "economy",
      });
      if (res.status === "live_checked" && res.data && res.data.length > 0) {
        liveFlightUSD = res.data[0].totalPriceUSD;
        flightSource = "live";
      }
    } catch {
      // ignore — we'll fall back to seed
    }
  }

  // Try to get a hotel estimate
  const hotel = hotelProvider();
  let hotelTotal = 0;
  if (hotel) {
    try {
      const res = await hotel.estimate({
        destination,
        nights,
        comfortLevel: comfort,
        guests,
      });
      if (res.data) {
        hotelTotal = res.data.perNight.expected * nights;
      }
    } catch {
      /* ignore */
    }
  }

  const buildComponents = (): PriceEstimate[] => {
    if (!seed) {
      // Generic fallback numbers when destination isn't seeded
      const base = [
        { c: "Flights", min: 400 * guests, expected: 700 * guests, max: 1200 * guests, conf: "low" },
        { c: "Lodging", min: 60 * nights, expected: 120 * nights, max: 240 * nights, conf: "low" },
        { c: "Food", min: 25 * guests * nights, expected: 45 * guests * nights, max: 90 * guests * nights, conf: "low" },
        { c: "Local transport", min: 6 * guests * nights, expected: 12 * guests * nights, max: 25 * guests * nights, conf: "low" },
        { c: "Activities", min: 20 * guests * nights * 0.5, expected: 40 * guests * nights * 0.7, max: 100 * guests * nights * 0.5, conf: "low" },
        { c: "Events", min: 0, expected: 60 * guests, max: 200 * guests, conf: "low" },
        { c: "Insurance (est.)", min: 40 * guests, expected: 65 * guests, max: 100 * guests, conf: "medium" },
      ];
      return base.map((r) => {
        const scaled = scale({ min: r.min, expected: r.expected, max: r.max }, mult);
        return {
          component: r.c,
          currency: "USD",
          confidence: r.conf as PriceEstimate["confidence"],
          status: "estimated",
          source: "internal_heuristic_v1",
          checkedAt: new Date().toISOString(),
          ...scaled,
        };
      });
    }

    // Use seed data as the estimated baseline, override individual rows
    // when live sources exist.
    const seedByPrefix = (prefix: string) =>
      seed.estimates.find((e) =>
        e.component.toLowerCase().startsWith(prefix.toLowerCase()),
      );

    const flightsSeed = seedByPrefix("Flights");
    const flightsRow: PriceEstimate = liveFlightUSD
      ? {
          component: "Flights (live)",
          min: Math.round(liveFlightUSD * 0.9),
          expected: liveFlightUSD,
          max: Math.round(liveFlightUSD * 1.15),
          currency: "USD",
          confidence: "high",
          status: "live_checked",
          source: "fast-flights",
          checkedAt: new Date().toISOString(),
        }
      : flightsSeed
        ? { ...flightsSeed, ...scale(flightsSeed, 1) }
        : {
            component: "Flights",
            min: 400,
            expected: 700,
            max: 1200,
            currency: "USD",
            confidence: "low",
            status: "estimated",
            source: "fallback",
            checkedAt: new Date().toISOString(),
          };

    const lodgingSeed = seedByPrefix("Lodging");
    const lodgingRow: PriceEstimate = hotelTotal > 0
      ? {
          component: "Lodging",
          min: Math.round(hotelTotal * 0.7),
          expected: hotelTotal,
          max: Math.round(hotelTotal * 1.4),
          currency: "USD",
          confidence: "medium",
          status: "estimated",
          source: "hotels-provider",
          checkedAt: new Date().toISOString(),
        }
      : lodgingSeed
        ? { ...lodgingSeed, ...scale(lodgingSeed, mult) }
        : {
            component: "Lodging",
            min: 60 * nights,
            expected: 120 * nights,
            max: 240 * nights,
            currency: "USD",
            confidence: "low",
            status: "estimated",
            source: "fallback",
            checkedAt: new Date().toISOString(),
          };

    const otherRows = seed.estimates
      .filter(
        (e) =>
          !e.component.toLowerCase().startsWith("flights") &&
          !e.component.toLowerCase().startsWith("lodging") &&
          !e.component.toLowerCase().startsWith("buffer"),
      )
      .map((e) => ({ ...e, ...scale(e, mult) }));

    // Add buffer as 10% of everything else
    const rowsSoFar = [flightsRow, lodgingRow, ...otherRows];
    const subtotal = rowsSoFar.reduce((acc, r) => acc + r.expected, 0);
    const buffer: PriceEstimate = {
      component: "Buffer (10%)",
      min: Math.round(subtotal * 0.05),
      expected: Math.round(subtotal * 0.1),
      max: Math.round(subtotal * 0.2),
      currency: "USD",
      confidence: "low",
      status: "estimated",
      source: "internal_heuristic_v1",
      checkedAt: new Date().toISOString(),
    };

    return [...rowsSoFar, buffer];
  };

  const components = buildComponents();
  const total = components.reduce(
    (acc, c) => ({
      min: acc.min + c.min,
      expected: acc.expected + c.expected,
      max: acc.max + c.max,
    }),
    { min: 0, expected: 0, max: 0 },
  );

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
            Pricing dashboard
          </div>
          <h1 className="font-serif text-3xl">
            {formatUSD(total.expected)}
          </h1>
          <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
            {formatUSD(total.min)} – {formatUSD(total.max)} · {guests} guest
            {guests === 1 ? "" : "s"} · {nights} nights ·{" "}
            {flightSource === "live" ? (
              <span className="status-est status-live inline-flex">
                <span className="status-dot" /> Flights: live
              </span>
            ) : (
              <span className="status-est inline-flex">
                <span className="status-dot" /> Flights: estimated
              </span>
            )}
          </p>
        </div>

        {/* Comfort switcher */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(["budget", "standard", "premium", "luxury"] as const).map((c) => (
            <Link
              key={c}
              href={`/trips/${trip.id}/pricing?comfort=${c}&guests=${guests}`}
              className="chip capitalize"
              data-selected={comfort === c}
            >
              {c}
            </Link>
          ))}
        </div>

        {/* Line items */}
        <div className="card overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface-2)]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                  Component
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                  Range
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                  Expected
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr
                  key={c.component}
                  className="border-b border-[color:var(--color-line)] last:border-0"
                >
                  <td className="px-4 py-3 text-[color:var(--color-fg-2)]">
                    {c.component}
                  </td>
                  <td className="px-4 py-3 text-right text-[color:var(--color-muted)] text-xs">
                    {formatUSD(c.min)} – {formatUSD(c.max)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatUSD(c.expected)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`status-est ${
                        c.status === "live_checked" ? "status-live" : ""
                      }`}
                    >
                      <span className="status-dot" />
                      {c.status === "live_checked" ? "Live" : "Estimated"}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-[color:var(--color-surface-2)]">
                <td className="px-4 py-3 font-medium">Total</td>
                <td className="px-4 py-3 text-right text-[color:var(--color-muted)] text-xs">
                  {formatUSD(total.min)} – {formatUSD(total.max)}
                </td>
                <td className="px-4 py-3 text-right font-serif text-lg text-[color:var(--color-primary)]">
                  {formatUSD(total.expected)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
        </div>

        <p className="text-xs text-[color:var(--color-muted)]">
          Line items marked <em>Live</em> are queried at page load. Everything
          else is a seed heuristic — swap in real inventory APIs to promote
          rows to live prices.
        </p>
      </main>
    </>
  );
}
