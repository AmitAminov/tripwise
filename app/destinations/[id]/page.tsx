import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient, safeGetUser } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { getDestination } from "@/data/destinations";
import { formatUSD } from "@/lib/format";
import { CostBreakdown } from "@/components/cost-breakdown";
import { placesProvider, eventsProvider } from "@/lib/providers";
import type { Place, EventItem } from "@/lib/providers/types";
import { detectRegionalScope } from "@/lib/destination-scope";
import { centroidFor } from "@/lib/country-centroids";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = getDestination(id);
  if (!d) notFound();

  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  // Live Places + Events, in parallel. Both are optional — the page still
  // renders if the providers are absent or the calls fail.
  const places = placesProvider();
  const events = eventsProvider();
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    .toISOString();

  const scope = detectRegionalScope(d.id, d.name);

  const [attractionsRes, eventsRes] = await Promise.all([
    places
      ? places.search({
          center: d.coords,
          kind: "attractions",
          regional: scope.regional,
          regionQuery: scope.regionQuery,
          countryFilter: d.country,
          directionFilter:
            scope.direction && centroidFor(d.country)
              ? { direction: scope.direction, centroid: centroidFor(d.country)! }
              : undefined,
          limit: 20,
        })
      : Promise.resolve(null),
    events
      ? events.search({
          city: d.name,
          from: windowStart,
          to: windowEnd,
          limit: 5,
        })
      : Promise.resolve(null),
  ]);

  const attractions: Place[] =
    attractionsRes?.status === "live_checked" && attractionsRes.data
      ? attractionsRes.data
      : [];
  const upcomingEvents: EventItem[] = eventsRes?.data ?? [];

  const [c1, c2] = d.gradient;

  return (
    <>
      <Header email={user?.email} />

      {/* Editorial hero */}
      <section
        className="relative overflow-hidden"
        style={
          d.hasHero
            ? undefined
            : { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }
        }
      >
        {d.hasHero && (
          <Image
            src={`/destinations/${d.id}.png`}
            alt={`${d.name}, ${d.country}`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24 text-white">
          <Link
            href="/"
            className="text-sm text-white/80 hover:text-white mb-6 inline-block"
          >
            ← Back
          </Link>
          <div className="text-sm uppercase tracking-widest text-white/70 mb-2">
            {d.country} · {d.region}
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl leading-[1.05]">
            {d.name}
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-2xl italic">
            {d.tagline}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-highlight)]" />
            AI-generated hero · Nano Banana
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Quick facts */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <QuickFact
            label="Flight from TLV"
            value={
              d.flightFromTLV.directAvailable
                ? `Direct · ${d.flightFromTLV.typicalDurationHours}h`
                : `${d.flightFromTLV.typicalStops} stop · ~${d.flightFromTLV.typicalDurationHours}h`
            }
          />
          <QuickFact
            label="Visa (IL passport)"
            value={
              d.visa.forIsraeliPassport === "visa_free"
                ? "Visa-free"
                : d.visa.forIsraeliPassport.replace(/_/g, " ")
            }
          />
          <QuickFact
            label="Weather in-season"
            value={`${d.climate.tempMinC}–${d.climate.tempMaxC}°C`}
            hint={`~${d.climate.rainDaysExpected} rain days`}
          />
          <QuickFact
            label="Safety"
            value={d.safety.level.replace(/_/g, " ")}
          />
        </section>

        <div className="grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2 space-y-10">
            <section>
              <h2 className="font-serif text-2xl mb-3">Why it fits</h2>
              <ul className="space-y-2">
                {d.bestFor.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[color:var(--color-fg-2)]"
                  >
                    <span
                      className="text-[color:var(--color-accent)] mt-1 shrink-0"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl mb-3">In-season notes</h2>
              <p className="text-[color:var(--color-fg-2)] leading-relaxed">
                {d.climate.seasonNote}
              </p>
              <div className="mt-4 card p-4 text-sm text-[color:var(--color-fg-2)]">
                <div className="font-medium text-[color:var(--color-fg)] mb-1">
                  Visa detail
                </div>
                {d.visa.note}
              </div>
              <div className="mt-3 card p-4 text-sm text-[color:var(--color-fg-2)]">
                <div className="font-medium text-[color:var(--color-fg)] mb-1">
                  Safety detail
                </div>
                {d.safety.note}
              </div>
            </section>

            <section>
              <h2 className="font-serif text-2xl mb-3">Interests it hits</h2>
              <ul className="flex flex-wrap gap-2">
                {d.interestSignals.map((tag) => (
                  <li key={tag} className="chip">
                    {tag.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-2xl mb-3">Top attractions</h2>
              {attractions.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {attractions.map((p) => (
                    <li
                      key={p.id}
                      className="card p-4 flex gap-3 items-start"
                    >
                      {p.photoUrl ? (
                        <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-[color:var(--color-surface-2)]">
                          <Image
                            src={p.photoUrl}
                            alt={p.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 shrink-0 rounded-md bg-gradient-to-br from-[color:var(--color-surface-2)] to-[color:var(--color-line)]" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-[color:var(--color-muted)] capitalize">
                          {p.category.replace(/_/g, " ")}
                        </div>
                        {typeof p.rating === "number" && (
                          <div className="text-xs mt-0.5">
                            ★ {p.rating.toFixed(1)}
                            {p.ratingCount && (
                              <span className="text-[color:var(--color-muted)]">
                                {" "}
                                ({p.ratingCount.toLocaleString()})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card p-4 text-sm text-[color:var(--color-muted)]">
                  {places
                    ? "Places API didn't return results for this area."
                    : "Set GOOGLE_MAPS_API_KEY in .env.local to see live attractions here."}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-serif text-2xl mb-3">What&apos;s on soon</h2>
              {upcomingEvents.length > 0 ? (
                <ul className="space-y-2">
                  {upcomingEvents.map((e) => (
                    <li
                      key={e.id}
                      className="card p-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
                          {e.startAt.slice(0, 10)}
                          {e.venueName ? ` · ${e.venueName}` : ""}
                        </div>
                      </div>
                      {e.ticketUrl && (
                        <a
                          href={e.ticketUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn btn-ghost text-xs shrink-0"
                        >
                          Tickets →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card p-4 text-sm text-[color:var(--color-muted)]">
                  No curated or live events land in the next two months for{" "}
                  {d.name}. Live inventory expands when PredictHQ or
                  Ticketmaster keys are set.
                </div>
              )}
            </section>
          </div>

          {/* Cost sidebar */}
          <aside className="md:col-span-1">
            <div className="card p-5 sticky top-6">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-serif text-xl">Estimated total</h3>
                <div className="status-est">
                  <span className="status-dot" /> Estimated
                </div>
              </div>
              <div className="text-3xl font-serif text-[color:var(--color-primary)]">
                {formatUSD(d.totalEstimate.expected)}
              </div>
              <div className="text-sm text-[color:var(--color-muted)] mb-4">
                {formatUSD(d.totalEstimate.min)} –{" "}
                {formatUSD(d.totalEstimate.max)} · 2 pax · 7 nights
              </div>
              <CostBreakdown estimates={d.estimates} />
              {user ? (
                <>
                  <Link
                    href={`/trips/new?destination=${encodeURIComponent(d.name)}&name=${encodeURIComponent(`${d.name} · Trip`)}`}
                    className="btn btn-primary w-full mt-5"
                    title="Create a trip and jump into map, day plan, and calendar export"
                  >
                    Start planning →
                  </Link>
                  <Link
                    href={`/survey/deep_research?destination=${encodeURIComponent(d.id)}`}
                    className="btn btn-ghost w-full mt-2 text-sm"
                  >
                    Or answer the full survey first
                  </Link>
                </>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/trips/new?destination=${d.name}`)}`}
                  className="btn btn-primary w-full mt-5"
                >
                  Sign in to plan a trip
                </Link>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function QuickFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)] mb-1">
        {label}
      </div>
      <div className="font-medium capitalize">{value}</div>
      {hint && (
        <div className="text-xs text-[color:var(--color-subtle)] mt-1">
          {hint}
        </div>
      )}
    </div>
  );
}
