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
  const destinationParam = Array.isArray(sp.destination)
    ? sp.destination[0]
    : sp.destination;
  const nameParam = Array.isArray(sp.name) ? sp.name[0] : sp.name;

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
        />
      </main>
    </>
  );
}
