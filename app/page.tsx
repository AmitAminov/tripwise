import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DESTINATIONS, FEATURED_DESTINATIONS } from "@/data/destinations";
import { Header } from "@/components/header";
import { DestinationHeroCard } from "@/components/destination-hero-card";
import { PlanningDepthSelector } from "@/components/planning-depth-selector";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recentTrips } = user
    ? await supabase
        .from("trips")
        .select("id, name, destination, start_date, end_date")
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: null };

  return (
    <>
      <Header email={user?.email} />
      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-16">
        {/* Hero */}
        <section className="mb-14 max-w-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-emblem.png" alt="TripWise" width={72} height={72} className="mb-5" />
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Plan the trip.{" "}
            <span className="text-[color:var(--color-accent)]">Together.</span>
          </h1>
          <p className="mt-4 text-lg text-[color:var(--color-fg-2)] leading-relaxed">
            Compare destinations, estimate the real cost, build the itinerary,
            and settle disagreements without the group-chat archaeology.
          </p>
        </section>

        {/* Planning depth selector — the primary entry point */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-2xl">Where do you want to start?</h2>
            <p className="text-sm text-[color:var(--color-muted)] hidden sm:block">
              Pick the depth that matches how much time you have.
            </p>
          </div>
          <PlanningDepthSelector />
        </section>

        {/* Signed-in: recent trips shortcut */}
        {user && recentTrips && recentTrips.length > 0 && (
          <section className="mb-16">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif text-2xl">Your trips</h2>
              <Link
                href="/trips"
                className="btn btn-link text-sm"
              >
                View all →
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              {recentTrips.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="card block p-4 h-full"
                  >
                    <div className="font-medium truncate">{t.name}</div>
                    {t.destination && (
                      <div className="text-sm text-[color:var(--color-muted)] truncate">
                        {t.destination}
                      </div>
                    )}
                    {(t.start_date || t.end_date) && (
                      <div className="text-xs text-[color:var(--color-subtle)] mt-2">
                        {t.start_date} → {t.end_date}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Featured destinations — hand-tuned hero set only.
            The full 50-destination catalog lives on /compare. */}
        <section className="mb-4">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-2xl">Featured — autumn 2026</h2>
            <Link href="/compare" className="btn btn-link text-sm">
              Compare all {DESTINATIONS.length} →
            </Link>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {FEATURED_DESTINATIONS.map((d) => (
              <li key={d.id}>
                <DestinationHeroCard destination={d} />
              </li>
            ))}
          </ul>
        </section>

        {!user && (
          <section className="mt-16 border-t border-[color:var(--color-line)] pt-10 text-center">
            <p className="text-[color:var(--color-muted)] mb-4">
              Sign in to save trips and invite your partner.
            </p>
            <Link href="/login" className="btn btn-primary inline-flex">
              Sign in with email
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
