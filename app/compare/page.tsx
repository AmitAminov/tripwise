import Link from "next/link";
import Image from "next/image";
import { createClient, safeGetUser } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import {
  DESTINATIONS,
  COUNTRY_WIDE_DESTINATIONS,
  type DestinationCard,
} from "@/data/destinations";
import { formatUSD } from "@/lib/format";
import {
  decodeIntent,
  rankDestinations,
  type RankedDestination,
} from "@/lib/scoring";
import { CountryFlag } from "@/components/country-flag";
import { DestinationPicker, type PickerItem } from "./destination-picker";
import { openMeteoProvider } from "@/lib/providers/weather/openmeteo";
import type { WeatherForecast } from "@/lib/providers/types";

type Row = {
  label: string;
  render: (d: DestinationCard) => React.ReactNode;
};

interface WeatherCell {
  forecast: WeatherForecast | null;
  status: "live_checked" | "cached" | "unavailable";
}

/**
 * Build the compare rows. Weather is date-window-specific when the intent
 * has concrete dates + we could reach OpenMeteo; otherwise it falls back
 * to the seasonal seed on the destination card.
 */
function buildRows(
  weatherByDest: Map<string, WeatherCell>,
  windowLabel: string | null,
): Row[] {
  return [
    {
      label: "Total (2 pax · 7 nts)",
      render: (d) => (
        <>
          <div className="font-serif text-2xl text-[color:var(--color-primary)]">
            {formatUSD(d.totalEstimate.expected)}
          </div>
          <div className="text-xs text-[color:var(--color-muted)] mt-1">
            {formatUSD(d.totalEstimate.min)} – {formatUSD(d.totalEstimate.max)}
          </div>
        </>
      ),
    },
    {
      label: "Flight",
      render: (d) =>
        d.flightFromTLV.directAvailable
          ? `Direct · ${d.flightFromTLV.typicalDurationHours}h`
          : `${d.flightFromTLV.typicalStops} stop · ~${d.flightFromTLV.typicalDurationHours}h`,
    },
    {
      label: windowLabel ? `Weather (${windowLabel})` : "Weather (in-season)",
      render: (d) => {
        const cell = weatherByDest.get(d.id);
        if (cell?.forecast) {
          const f = cell.forecast;
          return (
            <>
              {Math.round(f.minTempC)}–{Math.round(f.maxTempC)}°C
              <div className="text-xs text-[color:var(--color-muted)]">
                ~{f.rainDays} rain days
                <span className="ml-1 opacity-70">
                  · {cell.status === "cached" ? "cached" : "live"}
                </span>
              </div>
            </>
          );
        }
        return (
          <>
            {d.climate.tempMinC}–{d.climate.tempMaxC}°C
            <div className="text-xs text-[color:var(--color-muted)]">
              ~{d.climate.rainDaysExpected} rain days
              <span className="ml-1 opacity-70">· seasonal</span>
            </div>
          </>
        );
      },
    },
    {
      label: "Visa",
      render: (d) =>
        d.visa.forIsraeliPassport === "visa_free"
          ? "Visa-free"
          : d.visa.forIsraeliPassport.replace(/_/g, " "),
    },
    {
      label: "Safety",
      render: (d) => (
        <span className="capitalize">{d.safety.level.replace(/_/g, " ")}</span>
      ),
    },
    {
      label: "Interests hit",
      render: (d) => (
        <div className="flex flex-wrap gap-1.5">
          {d.interestSignals.slice(0, 4).map((s) => (
            <span key={s} className="chip text-[11px] py-0">
              {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ),
    },
  ];
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; ids?: string }>;
}) {
  const params = await searchParams;
  const intent = decodeIntent(params.intent ?? null);

  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  // Precedence:
  //  1. ?ids= from the picker (user's explicit choice)
  //  2. intent.candidateDestinations (from a survey)
  //  3. everything
  const idsParam = params.ids
    ? params.ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const validIds = new Set(DESTINATIONS.map((d) => d.id));
  const explicitIds = idsParam.filter((id) => validIds.has(id));
  const candidateIds = intent?.candidateDestinations;

  const filtered =
    explicitIds.length > 0
      ? DESTINATIONS.filter((d) => explicitIds.includes(d.id))
      : candidateIds && candidateIds.length > 0
        ? DESTINATIONS.filter((d) => candidateIds.includes(d.id))
        : DESTINATIONS;

  const TOP_N = 5;
  const rankedAll: RankedDestination[] | null = intent
    ? rankDestinations(filtered, intent)
    : null;
  const ranked = rankedAll ? rankedAll.slice(0, TOP_N) : null;
  // For the compare TABLE we show the top-5 when ranked, or up to 5 selected
  // when the user is browsing without an intent.
  const displayed: DestinationCard[] = ranked
    ? ranked.map((r) => r.destination)
    : filtered.slice(0, TOP_N);

  const pickerItems: PickerItem[] = DESTINATIONS.map((d) => ({
    id: d.id,
    name: d.name,
    country: d.country,
    isCountryWide: COUNTRY_WIDE_DESTINATIONS.some((cw) => cw.id === d.id),
  }));
  const initialSelected =
    explicitIds.length > 0
      ? explicitIds
      : filtered.map((d) => d.id);

  // Budget range implication strip: only render when the user gave a range.
  const bMin = intent?.budget.perPersonMin;
  const bMax = intent?.budget.perPersonMax;
  const hasBudgetRange =
    typeof bMin === "number" && typeof bMax === "number" && bMax > bMin;

  // Date-window-specific weather. When the intent has concrete dates (or a
  // flexible window), fetch OpenMeteo for each top-N destination in parallel
  // so rain days + temps reflect the actual travel week, not a seasonal
  // average. Falls back to the seed climate silently on any error.
  const tripFrom = intent?.startDate ?? intent?.windowStart ?? null;
  const tripTo = intent?.endDate ?? intent?.windowEnd ?? null;
  const weatherByDest = new Map<string, WeatherCell>();
  let windowLabel: string | null = null;
  if (tripFrom && tripTo) {
    windowLabel = `${tripFrom.slice(5)} → ${tripTo.slice(5)}`;
    const results = await Promise.all(
      displayed.map(async (d) => {
        const res = await openMeteoProvider.forecast(
          d.coords.lat,
          d.coords.lng,
          tripFrom,
          tripTo,
        );
        return { id: d.id, res };
      }),
    );
    for (const { id, res } of results) {
      weatherByDest.set(id, {
        forecast: res.data,
        status:
          res.status === "live_checked"
            ? "live_checked"
            : res.status === "cached"
              ? "cached"
              : "unavailable",
      });
    }
  }
  const ROWS = buildRows(weatherByDest, windowLabel);

  // Prefill helper: when a user clicks "Start planning" on a ranked
  // destination we hand them straight to /trips/new with the destination
  // name + trip window baked in. This is the loop-breaker: previously the
  // CTA went back to the survey.
  function newTripHref(d: DestinationCard): string {
    const params = new URLSearchParams({ destination: d.name });
    if (intent?.startDate) params.set("start", intent.startDate);
    if (intent?.endDate) params.set("end", intent.endDate);
    if (intent) params.set("name", `${d.name} · Trip`);
    return `/trips/new?${params.toString()}`;
  }

  return (
    <>
      <Header email={user?.email} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← Home
          </Link>
        </div>

        <h1 className="font-serif text-4xl mb-2">
          {intent ? "Ranked for you" : "Compare destinations"}
        </h1>
        <p className="text-[color:var(--color-fg-2)] mb-8">
          {intent ? (
            <>
              Based on your survey answers · scores use interest match, budget
              fit, flight convenience, weather, visa, safety, and travel
              fatigue.
            </>
          ) : (
            <>
              Pick which destinations to compare, or answer a short survey and
              we&apos;ll rank them for you. All figures are{" "}
              <span className="text-[color:var(--color-muted)]">estimated</span>{" "}
              until live provider data arrives.
            </>
          )}
        </p>

        <DestinationPicker items={pickerItems} initialSelected={initialSelected} />

        {/* Ranked pills — top 5 when we have an intent */}
        {ranked && ranked.length > 0 && (
          <>
            <p className="text-sm text-[color:var(--color-muted)] mb-3">
              Top {ranked.length} of {rankedAll?.length ?? 0} destinations
              scored against your answers.
            </p>
            <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ranked.map((r, i) => (
                <RankedCard
                  key={r.destination.id}
                  rank={i + 1}
                  ranked={r}
                  travelerAdults={intent?.travelers.adults ?? 2}
                  budgetRange={
                    hasBudgetRange
                      ? { min: bMin as number, max: bMax as number }
                      : null
                  }
                  newTripHref={newTripHref(r.destination)}
                  signedIn={Boolean(user)}
                />
              ))}
            </div>
          </>
        )}

        {/* Hero row (unranked mode) */}
        {!intent && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {filtered.map((d) => {
              const [c1, c2] = d.gradient;
              return (
                <Link
                  key={d.id}
                  href={`/destinations/${d.id}`}
                  className="card block overflow-hidden group"
                >
                  <div
                    className="h-28 relative"
                    style={
                      d.hasHero
                        ? undefined
                        : {
                            background: `linear-gradient(135deg, ${c1}, ${c2})`,
                          }
                    }
                  >
                    {d.hasHero && (
                      <Image
                        src={`/destinations/${d.id}.png`}
                        alt={`${d.name}, ${d.country}`}
                        fill
                        sizes="33vw"
                        className="object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <div className="font-serif text-lg leading-tight">
                        {d.name}
                      </div>
                      <div className="text-xs opacity-80 flex items-center gap-1.5">
                        <CountryFlag country={d.country} size={14} />
                        <span>{d.country}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 text-xs text-[color:var(--color-fg-2)] italic">
                    {d.tagline}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Comparison table */}
        {displayed.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[color:var(--color-surface-2)]">
                    <th
                      scope="col"
                      className="text-left align-bottom px-5 py-4 text-xs uppercase tracking-widest text-[color:var(--color-muted)] font-medium w-1/5"
                    >
                      Compared
                    </th>
                    {displayed.map((d) => (
                      <th
                        key={d.id}
                        scope="col"
                        className="text-left align-bottom px-5 py-4"
                      >
                        <Link
                          href={`/destinations/${d.id}`}
                          className="group inline-flex flex-col"
                        >
                          <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] flex items-center gap-1.5">
                            <CountryFlag country={d.country} size={14} />
                            <span>{d.country}</span>
                          </span>
                          <span className="font-serif text-lg text-[color:var(--color-fg)] group-hover:text-[color:var(--color-primary)] leading-tight">
                            {d.name}
                          </span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-t border-[color:var(--color-line)]"
                    >
                      <th
                        scope="row"
                        className="text-left align-top px-5 py-4 text-xs uppercase tracking-widest text-[color:var(--color-muted)] font-medium w-1/5"
                      >
                        {row.label}
                      </th>
                      {displayed.map((d) => (
                        <td
                          key={d.id}
                          className="align-top px-5 py-4 text-[color:var(--color-fg-2)]"
                        >
                          {row.render(d)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {displayed.length === 0 && (
          <div className="card p-6 text-sm text-[color:var(--color-fg-2)]">
            No destinations selected. Open the picker above and pick at least one.
          </div>
        )}

        {!intent && (
          <div className="mt-8 flex gap-3">
            <Link href="/survey/plan_now" className="btn btn-primary">
              Answer 5 questions and rank these →
            </Link>
            <Link href="/" className="btn btn-ghost">
              Back to home
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

function RankedCard({
  rank,
  ranked,
  budgetRange,
  travelerAdults,
  newTripHref,
  signedIn,
}: {
  rank: number;
  ranked: RankedDestination;
  budgetRange: { min: number; max: number } | null;
  travelerAdults: number;
  newTripHref: string;
  signedIn: boolean;
}) {
  const d = ranked.destination;
  const [c1, c2] = d.gradient;
  return (
    <div className="card overflow-hidden">
      <div
        className="h-28 relative"
        style={
          d.hasHero
            ? undefined
            : { background: `linear-gradient(135deg, ${c1}, ${c2})` }
        }
      >
        {d.hasHero && (
          <Image
            src={`/destinations/${d.id}.png`}
            alt={`${d.name}, ${d.country}`}
            fill
            sizes="33vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">
              Rank #{rank}
            </div>
            <div className="font-serif text-lg leading-tight flex items-center gap-1.5">
              <CountryFlag country={d.country} size={18} />
              <span>{d.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-serif tabular-nums">
              {ranked.score.toFixed(1)}
            </div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">
              Score
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        {ranked.reasons.length > 0 && (
          <ul className="space-y-1 text-sm text-[color:var(--color-fg-2)] mb-3">
            {ranked.reasons.slice(0, 3).map((r) => (
              <li key={r} className="flex gap-2">
                <span
                  className="text-[color:var(--color-accent)] mt-0.5 shrink-0"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        {ranked.concerns.length > 0 && (
          <ul className="space-y-1 text-sm text-[color:var(--color-muted)] mb-3">
            {ranked.concerns.slice(0, 2).map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-[color:var(--color-warn)] mt-0.5 shrink-0">
                  !
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        {budgetRange && (
          <BudgetRangeStrip
            destination={d}
            range={budgetRange}
            adults={travelerAdults}
          />
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href={
              signedIn
                ? newTripHref
                : `/login?next=${encodeURIComponent(newTripHref)}`
            }
            className="btn btn-primary text-xs px-3 py-1.5"
            title="Create a trip for this destination and jump into map + day plan"
          >
            Start planning →
          </Link>
          <Link
            href={`/destinations/${ranked.destination.id}`}
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact "what each end of your budget enables" strip. Uses the seed
 * cost expectations as anchors:
 *   - Low end: 1-2 stars, hostels/guesthouses, mostly free attractions,
 *     street food, connecting flights.
 *   - High end: 4-5 star hotels, guided experiences, fine dining, direct
 *     flights (when the destination has any).
 *
 * The numbers are the total trip budget (per-person × adults) and how they
 * relate to the destination's `totalEstimate.expected` at standard comfort.
 */
function BudgetRangeStrip({
  destination,
  range,
  adults,
}: {
  destination: DestinationCard;
  range: { min: number; max: number };
  adults: number;
}) {
  const trip = destination.totalEstimate; // standard comfort baseline
  const lowTotal = range.min * Math.max(1, adults);
  const highTotal = range.max * Math.max(1, adults);
  const lowRatio = lowTotal / trip.expected;
  const highRatio = highTotal / trip.expected;

  function tier(ratio: number): {
    label: string;
    bullets: string[];
    tone: "warn" | "ok" | "good";
  } {
    if (ratio < 0.75) {
      return {
        label: "Backpacker",
        tone: "warn",
        bullets: [
          "Hostels / guesthouses only",
          "Street food + supermarket",
          "Connecting or budget-carrier flights",
        ],
      };
    }
    if (ratio < 1.05) {
      return {
        label: "Standard",
        tone: "ok",
        bullets: [
          "3-star hotels or well-rated Airbnb",
          "Mid-range restaurants + some splurges",
          destination.flightFromTLV.directAvailable
            ? "Direct flights on regular carriers"
            : "Connecting flight with one stop",
        ],
      };
    }
    if (ratio < 1.5) {
      return {
        label: "Comfortable",
        tone: "good",
        bullets: [
          "4-star hotels, central location",
          "Fine-dining nights + drivers",
          "Direct flight, extras like priority seat",
        ],
      };
    }
    return {
      label: "Premium",
      tone: "good",
      bullets: [
        "5-star or boutique / villa",
        "Michelin-quality + private guides",
        "Premium cabin on direct flight",
      ],
    };
  }

  const low = tier(lowRatio);
  const high = tier(highRatio);

  return (
    <div className="mt-3 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-surface-2)] p-3 text-xs">
      <div className="uppercase tracking-widest text-[10px] text-[color:var(--color-muted)] mb-2">
        What each end of your budget buys
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-medium mb-1">
            ${range.min.toLocaleString()} pp — {low.label}
          </div>
          <ul className="space-y-0.5 text-[color:var(--color-fg-2)]">
            {low.bullets.map((b) => (
              <li key={b}>· {b}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">
            ${range.max.toLocaleString()} pp — {high.label}
          </div>
          <ul className="space-y-0.5 text-[color:var(--color-fg-2)]">
            {high.bullets.map((b) => (
              <li key={b}>· {b}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
