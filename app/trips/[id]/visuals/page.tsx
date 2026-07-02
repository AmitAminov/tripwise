import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { resolveDestination } from "@/lib/destination-coords";
import { VisualsGallery } from "./visuals-gallery";

export default async function VisualsPage({
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
    .select("id, name, destination, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const destination = trip.destination ?? trip.name;
  const resolved = await resolveDestination(destination);
  const country = resolved?.country ?? "";

  // Derive a rough duration for the trip poster prompt
  let durationDays = 7;
  if (trip.start_date && trip.end_date) {
    const days = Math.round(
      (new Date(trip.end_date).getTime() -
        new Date(trip.start_date).getTime()) /
        86400_000,
    );
    if (days >= 1 && days <= 60) durationDays = days;
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

        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            AI Visuals
          </div>
          <h1 className="font-serif text-3xl">
            Mood board for {destination}
          </h1>
          <p className="text-sm text-[color:var(--color-fg-2)] mt-2 max-w-xl">
            Nano Banana generates editorial travel photos + a poster for
            your trip. Every image is labelled AI-generated. Uses cached
            results when the same prompt was already used — 6h TTL.
          </p>
        </div>

        <VisualsGallery
          destinationName={destination}
          country={country}
          durationDays={durationDays}
          fallbackCoords={
            resolved
              ? {
                  name: resolved.name,
                  lat: resolved.coords.lat,
                  lng: resolved.coords.lng,
                }
              : null
          }
        />
      </main>
    </>
  );
}
