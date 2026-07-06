import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { NewTripForm } from "./form";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const destinationParam = first(sp.destination);
  const nameParam = first(sp.name);
  const startParam = first(sp.start);
  const endParam = first(sp.end);
  const iso = (s: string | undefined) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;

  return (
    <>
      <Header email={user.email} />
      <main className="max-w-lg mx-auto p-6">
        <div className="mb-4">
          <Link
            href="/trips"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← Back to trips
          </Link>
        </div>
        <h1 className="font-serif text-3xl mb-6">New trip</h1>
        <NewTripForm
          defaultName={nameParam}
          defaultDestination={destinationParam}
          defaultStart={iso(startParam)}
          defaultEnd={iso(endParam)}
        />
      </main>
    </>
  );
}
