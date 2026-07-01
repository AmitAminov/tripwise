import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { getDestination } from "@/data/destinations";
import { formatUSD } from "@/lib/format";
import { CostBreakdown } from "@/components/cost-breakdown";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = getDestination(id);
  if (!d) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
              <h2 className="font-serif text-2xl mb-3">Attractions & events</h2>
              <div className="card p-6 text-center text-[color:var(--color-muted)]">
                <p className="mb-2">
                  Rich place data hooks up when Google Places is wired.
                </p>
                <p className="text-xs">
                  Events via Ticketmaster / PredictHQ arrive at the same time.
                </p>
              </div>
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
                <Link
                  href={`/trips/new?destination=${encodeURIComponent(d.name)}`}
                  className="btn btn-primary w-full mt-5"
                >
                  Save to a trip
                </Link>
              ) : (
                <Link href="/login" className="btn btn-primary w-full mt-5">
                  Sign in to save
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
