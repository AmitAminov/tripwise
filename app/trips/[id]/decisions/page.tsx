import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { NewDecisionForm } from "./new-decision-form";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-2)]",
  revealed: "bg-[color:var(--color-highlight)]/20 text-[color:var(--color-warn)]",
  decided: "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Rating in progress",
  revealed: "Ready to decide",
  decided: "Decided",
};

export default async function DecisionsPage({
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
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, title, category, status, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  const byStatus = {
    open: decisions?.filter((d) => d.status === "open") ?? [],
    revealed: decisions?.filter((d) => d.status === "revealed") ?? [],
    decided: decisions?.filter((d) => d.status === "decided") ?? [],
  };

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
            Decision arena
          </div>
          <h1 className="font-serif text-3xl">What are we deciding?</h1>
          <p className="text-[color:var(--color-fg-2)] mt-2 max-w-xl">
            Add options. You both rate them without seeing each other&apos;s
            picks. When you&apos;re both done, TripWise reveals the overlap
            and you decide together.
          </p>
        </div>

        <section className="mb-10">
          <NewDecisionForm tripId={trip.id} />
        </section>

        <DecisionGroup
          title="Ready to decide"
          decisions={byStatus.revealed}
          tripId={trip.id}
          accentClass="text-[color:var(--color-warn)]"
        />
        <DecisionGroup
          title="Rating in progress"
          decisions={byStatus.open}
          tripId={trip.id}
        />
        <DecisionGroup
          title="Decided"
          decisions={byStatus.decided}
          tripId={trip.id}
        />

        {(!decisions || decisions.length === 0) && (
          <div className="card p-8 text-center text-[color:var(--color-muted)]">
            No decisions yet. Add your first one above.
          </div>
        )}
      </main>
    </>
  );
}

function DecisionGroup({
  title,
  decisions,
  tripId,
  accentClass,
}: {
  title: string;
  decisions: { id: string; title: string; category: string; status: string }[];
  tripId: string;
  accentClass?: string;
}) {
  if (decisions.length === 0) return null;
  return (
    <section className="mb-8">
      <h2
        className={`text-xs font-medium uppercase tracking-widest mb-3 ${
          accentClass ?? "text-[color:var(--color-muted)]"
        }`}
      >
        {title} ({decisions.length})
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {decisions.map((d) => (
          <li key={d.id}>
            <Link
              href={`/trips/${tripId}/decisions/${d.id}`}
              className="card block p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-[color:var(--color-muted)] mt-1 capitalize">
                    {d.category.replace(/_/g, " ")}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-medium ${
                    STATUS_STYLES[d.status]
                  }`}
                >
                  {STATUS_LABEL[d.status]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
