import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { flightProvider } from "@/lib/providers";
import { FlightSearchForm } from "./search-form";
import { FlightOfferList } from "./offer-list";
import type { FlightSearchQuery } from "@/lib/providers/types";

function firstStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function FlightsPage({
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
    .select("id, name, destination, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const origin = (firstStr(sp.origin) ?? "TLV").toUpperCase();
  const destination = (firstStr(sp.destination) ?? "").toUpperCase();
  const depart = firstStr(sp.depart) ?? trip.start_date ?? "";
  const ret = firstStr(sp.return) ?? trip.end_date ?? "";
  const adults = Number(firstStr(sp.adults) ?? 2);
  const shouldSearch = destination.length === 3 && depart;

  let searchResult: Awaited<
    ReturnType<ReturnType<typeof flightProvider>["search"]>
  > | null = null;
  let usedQuery: FlightSearchQuery | null = null;

  if (shouldSearch) {
    usedQuery = {
      originAirport: origin,
      destinationAirport: destination,
      departDate: depart,
      returnDate: ret || undefined,
      adults,
      cabinClass: "economy",
    };
    const provider = flightProvider();
    searchResult = await provider.search(usedQuery);
  }

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

        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            Flights
          </div>
          <h1 className="font-serif text-3xl">
            Where and when are we flying?
          </h1>
          <p className="text-[color:var(--color-fg-2)] mt-1">
            Real prices via fast-flights (Google Flights), converted to USD
            with daily FX.
          </p>
        </div>

        <div className="card p-5 mb-8">
          <FlightSearchForm
            defaultOrigin={origin}
            defaultDestination={destination}
            defaultDepart={depart}
            defaultReturn={ret}
            defaultAdults={adults}
            tripId={trip.id}
          />
        </div>

        {shouldSearch && searchResult && (
          <FlightOfferList
            result={searchResult}
            query={usedQuery!}
            tripId={trip.id}
          />
        )}

        {!shouldSearch && (
          <div className="card p-6 text-center text-[color:var(--color-muted)] text-sm">
            Enter a destination airport (IATA code) + depart date to see
            live offers.
          </div>
        )}
      </main>
    </>
  );
}
