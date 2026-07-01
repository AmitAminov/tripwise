import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { InvitePanel } from "./invite-panel";
import { formatDateRange } from "@/lib/format";

const V2_TABS = [
  { slug: "flights", label: "Flights", note: "search + save" },
  { slug: "hotels", label: "Hotels", note: "estimates + deep links" },
  { slug: "attractions", label: "Attractions", note: "Google Places" },
  { slug: "restaurants", label: "Restaurants", note: "Google Places" },
  { slug: "plan", label: "Day plan", note: "AI-generated draft" },
  { slug: "decisions", label: "Decisions", note: "the reveal mechanic" },
] as const;

export default async function TripDetailPage({
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
    .select("id, name, destination, start_date, end_date, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id, joined_at, profiles!inner(display_name, avatar_url)")
    .eq("trip_id", id);

  const { data: activeInvites } = await supabase
    .from("trip_invites")
    .select("token, expires_at")
    .eq("trip_id", id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  const activeInvite = activeInvites?.[0] ?? null;
  const range = formatDateRange(trip.start_date, trip.end_date);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href="/trips"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← Back to trips
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="font-serif text-4xl">{trip.name}</h1>
          {trip.destination && (
            <p className="text-lg text-[color:var(--color-fg-2)] mt-1">
              {trip.destination}
            </p>
          )}
          {range && (
            <p className="text-sm text-[color:var(--color-muted)] mt-1">
              {range}
            </p>
          )}
        </div>

        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
            Members ({members?.length ?? 0})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {members?.map((m) => {
              const profile = Array.isArray(m.profiles)
                ? m.profiles[0]
                : m.profiles;
              const name = profile?.display_name ?? "member";
              const self = m.user_id === user.id;
              return (
                <li key={m.user_id} className="chip">
                  {name}
                  {self && (
                    <span className="text-[color:var(--color-muted)]">
                      (you)
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
            Invite
          </h2>
          <InvitePanel
            tripId={trip.id}
            initialToken={activeInvite?.token ?? null}
            siteUrl={siteUrl}
          />
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-[color:var(--color-muted)] mb-3">
            Trip surfaces
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {V2_TABS.map((tab) => (
              <li key={tab.slug}>
                <div className="card p-4 h-full opacity-60">
                  <div className="font-medium mb-1">{tab.label}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">
                    {tab.note}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-highlight)] mt-3">
                    Coming soon
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
