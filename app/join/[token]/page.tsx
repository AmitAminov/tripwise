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

  // Fall through: show friendly error state.
  const message = error?.message ?? "This invite couldn't be used.";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Invite couldn&apos;t be used
        </h1>
        <p className="text-[color:var(--color-muted)] mb-6">{message}</p>
        <Link
          href="/trips"
          className="inline-block rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Go to your trips
        </Link>
      </div>
    </main>
  );
}
