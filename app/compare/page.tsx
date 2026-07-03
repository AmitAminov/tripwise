import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { DESTINATIONS, type DestinationCard } from "@/data/destinations";
import { formatUSD } from "@/lib/format";
import {
  decodeIntent,
  rankDestinations,
  type RankedDestination,
} from "@/lib/scoring";

type Row = {
  label: string;
  render: (d: DestinationCard) => React.ReactNode;
};

const ROWS: Row[] = [
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
    label: "Flight from TLV",
    render: (d) =>
      d.flightFromTLV.directAvailable
        ? `Direct · ${d.flightFromTLV.typicalDurationHours}h`
        : `${d.flightFromTLV.typicalStops} stop · ~${d.flightFromTLV.typicalDurationHours}h`,
  },
  {
    label: "Weather (in-season)",
    render: (d) => (
      <>
        {d.climate.tempMinC}–{d.climate.tempMaxC}°C
        <div className="text-xs text-[color:var(--color-muted)]">
          ~{d.climate.rainDaysExpected} rain days
        </div>
      </>
    ),
  },
  {
    label: "Visa (IL passport)",
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

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const params = await searchParams;
  const intent = decodeIntent(params.intent ?? null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // When intent has explicit candidateDestinations, honor them. Otherwise
  // rank the entire library so the survey can genuinely pick winners from
  // the whole 50-city set.
  const candidateIds = intent?.candidateDestinations;
  const filtered =
    candidateIds && candidateIds.length > 0
      ? DESTINATIONS.filter((d) => candidateIds.includes(d.id))
      : DESTINATIONS;

  const TOP_N = 5;
  const rankedAll: RankedDestination[] | null = intent
    ? rankDestinations(filtered, intent)
    : null;
  const ranked = rankedAll ? rankedAll.slice(0, TOP_N) : null;
  // For the compare TABLE we show the same top-5 to keep it scannable.
  // Without an intent, cap the un-ranked table at the first 5 seeds.
  const displayed: DestinationCard[] = ranked
    ? ranked.map((r) => r.destination)
    : filtered.slice(0, TOP_N);

  // Budget range implication strip: only render when the user gave a range.
  const bMin = intent?.budget.perPersonMin;
  const bMax = intent?.budget.perPersonMax;
  const hasBudgetRange =
    typeof bMin === "number" && typeof bMax === "number" && bMax > bMin;

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
          {intent ? "Ranked for you" : "Compare — autumn 2026"}
        </h1>
        <p className="text-[color:var(--color-fg-2)] mb-8">
          {intent ? (
            <>
              Based on your Plan Now answers · scores use interest match,
              budget fit, flight convenience, weather, visa, safety, and
              travel fatigue.
            </>
          ) : (
            <>
              One week between Sep 15 and Oct 10 · 2 travelers from Tel Aviv ·
              all figures{" "}
              <span className="text-[color:var(--color-muted)]">estimated</span>{" "}
              until live provider data arrives.
            </>
          )}
        </p>

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
                      <div className="text-xs opacity-80">{d.country}</div>
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
        <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={
                    i > 0
                      ? "border-t border-[color:var(--color-line)]"
                      : ""
                  }
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
}: {
  rank: number;
  ranked: RankedDestination;
  budgetRange: { min: number; max: number } | null;
  travelerAdults: number;
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
            <div className="font-serif text-lg leading-tight">
              {d.name}
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
        <div className="mt-4 flex gap-2">
          <Link
            href={`/destinations/${ranked.destination.id}`}
            className="btn btn-primary text-xs px-3 py-1.5"
          >
            Detail →
          </Link>
          <Link
            href={`/survey/deep_research?destination=${encodeURIComponent(d.id)}`}
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            Plan a trip here →
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
