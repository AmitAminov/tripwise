import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  const { data: tripId, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });

  if (!error && tripId) {
    redirect(`/trips/${tripId}`);
  }

  const message = error?.message ?? "This invite couldn't be used.";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--color-bg)]">
      <div className="card p-8 w-full max-w-sm text-center">
        <h1 className="font-serif text-2xl mb-2">Invite couldn&apos;t be used</h1>
        <p className="text-[color:var(--color-fg-2)] mb-6">{message}</p>
        <Link href="/trips" className="btn btn-primary inline-flex">
          Go to your trips
        </Link>
      </div>
    </main>
  );
}
