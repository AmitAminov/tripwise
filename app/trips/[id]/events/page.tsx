import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { eventsProvider } from "@/lib/providers";

function offsetDate(startIso: string, days: number): string {
  const d = new Date(startIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export default async function EventsPage({
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
  const from = trip.start_date
    ? trip.start_date + "T00:00:00Z"
    : new Date().toISOString();
  const to = trip.end_date
    ? trip.end_date + "T23:59:59Z"
    : offsetDate(from, 30);

  const provider = eventsProvider();
  const result = provider
    ? await provider.search({ city: destination, from, to, limit: 30 })
    : null;

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
            Events
          </div>
          <h1 className="font-serif text-3xl">
            What&apos;s on in {destination}
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1 flex flex-wrap gap-2 items-center">
            <span>{trip.start_date} → {trip.end_date}</span>
            <span>·</span>
            {result?.status === "live_checked" ? (
              <span className="status-est status-live inline-flex">
                <span className="status-dot" /> Live from{" "}
                {result.source ?? "PredictHQ"}
              </span>
            ) : (
              <span className="status-est inline-flex">
                <span className="status-dot" /> Curated
              </span>
            )}
            {result?.error && (
              <>
                <span>·</span>
                <span
                  className="status-est status-unavailable inline-flex"
                  title={result.error}
                >
                  <span className="status-dot" /> Live provider unavailable
                </span>
              </>
            )}
          </p>
        </div>

        {result?.data && result.data.length > 0 ? (
          <ul className="space-y-3">
            {result.data.map((e) => (
              <li key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{e.name}</div>
                    {e.venueName && (
                      <div className="text-sm text-[color:var(--color-fg-2)] mt-0.5">
                        {e.venueName}
                      </div>
                    )}
                    <div className="text-xs text-[color:var(--color-muted)] mt-1">
                      {e.startAt.slice(0, 10)}
                      {e.endAt && e.endAt.slice(0, 10) !== e.startAt.slice(0, 10)
                        ? ` – ${e.endAt.slice(0, 10)}`
                        : ""}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {e.categories.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-2)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  {e.ticketUrl && (
                    <a
                      href={e.ticketUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-ghost text-xs shrink-0"
                    >
                      Details →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-6 text-center text-[color:var(--color-muted)] text-sm">
            No curated events overlap this window. Real-time listings light up
            when you connect a Ticketmaster or PredictHQ key.
          </div>
        )}

        <p className="text-xs text-[color:var(--color-muted)] mt-6">
          {result?.status === "live_checked"
            ? "Live rankings from PredictHQ merged with our curated recurring festivals. Filtered by country hint so cities like \"New Prague, MN\" don't leak in."
            : "Hand-curated recurring festivals + cultural events. Live inventory lights up when PREDICTHQ_API_KEY is set."}
        </p>
      </main>
    </>
  );
}
