import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { formatDateRange } from "@/lib/format";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-3xl">Your trips</h1>
          <Link href="/trips/new" className="btn btn-primary">
            New trip
          </Link>
        </div>

        {error && (
          <p className="text-sm text-[color:var(--color-danger)] mb-4">
            Couldn&apos;t load trips: {error.message}
          </p>
        )}

        {!error && (!trips || trips.length === 0) ? (
          <div className="card p-8 text-center">
            <p className="text-[color:var(--color-fg-2)] mb-4">
              No trips yet. Start with a survey — or create one directly.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/" className="btn btn-primary">
                Start the survey
              </Link>
              <Link href="/trips/new" className="btn btn-ghost">
                Create manually
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trips?.map((t) => {
              const range = formatDateRange(t.start_date, t.end_date);
              return (
                <li key={t.id}>
                  <Link href={`/trips/${t.id}`} className="card block p-4">
                    <div className="font-medium truncate">{t.name}</div>
                    {t.destination && (
                      <div className="text-sm text-[color:var(--color-muted)] truncate">
                        {t.destination}
                      </div>
                    )}
                    {range && (
                      <div className="text-xs text-[color:var(--color-subtle)] mt-2">
                        {range}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
