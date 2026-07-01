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

  const candidateIds = intent?.candidateDestinations;
  const filtered =
    candidateIds && candidateIds.length > 0
      ? DESTINATIONS.filter((d) => candidateIds.includes(d.id))
      : DESTINATIONS;

  const ranked: RankedDestination[] | null = intent
    ? rankDestinations(filtered, intent)
    : null;
  const displayed: DestinationCard[] = ranked
    ? ranked.map((r) => r.destination)
    : filtered;

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

        {/* Ranked pills — only when we have an intent */}
        {ranked && ranked.length > 0 && (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {ranked.map((r, i) => (
              <RankedCard key={r.destination.id} rank={i + 1} ranked={r} />
            ))}
          </div>
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
}: {
  rank: number;
  ranked: RankedDestination;
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
          <ul className="space-y-1 text-sm text-[color:var(--color-muted)]">
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
        <div className="mt-4 flex gap-2">
          <Link
            href={`/destinations/${ranked.destination.id}`}
            className="btn btn-primary text-xs px-3 py-1.5"
          >
            Detail →
          </Link>
        </div>
      </div>
    </div>
  );
}
