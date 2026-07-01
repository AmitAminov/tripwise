import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Hello {user.email}
        </h1>
        <p className="text-[color:var(--color-muted)] mb-8">
          You&apos;re signed in. Day 2 builds the trip + invite flow.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
