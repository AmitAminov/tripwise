import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? null;
}

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
          <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
          <Link
            href="/trips/new"
            className="rounded-md bg-[color:var(--color-accent)] text-black font-medium px-4 py-2 hover:opacity-90"
          >
            New trip
          </Link>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4">
            Couldn&apos;t load trips: {error.message}
          </p>
        )}

        {!error && (!trips || trips.length === 0) ? (
          <div className="rounded-lg border border-white/10 p-8 text-center">
            <p className="text-[color:var(--color-muted)] mb-4">
              No trips yet. Create one and invite your partner.
            </p>
            <Link
              href="/trips/new"
              className="inline-block rounded-md bg-[color:var(--color-accent)] text-black font-medium px-4 py-2 hover:opacity-90"
            >
              Create your first trip
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trips?.map((t) => {
              const range = formatDateRange(t.start_date, t.end_date);
              return (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="block rounded-lg border border-white/10 p-4 hover:border-white/25 hover:bg-white/5"
                  >
                    <div className="font-medium truncate">{t.name}</div>
                    {t.destination && (
                      <div className="text-sm text-[color:var(--color-muted)] truncate">
                        {t.destination}
                      </div>
                    )}
                    {range && (
                      <div className="text-xs text-[color:var(--color-muted)] mt-2">
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
