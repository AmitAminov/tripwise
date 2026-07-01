import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Header({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-white/10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/trips" className="text-lg font-semibold tracking-tight">
          TripWise
        </Link>
        <div className="flex items-center gap-4">
          {email && (
            <span className="text-sm text-[color:var(--color-muted)] hidden sm:inline">
              {email}
            </span>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="text-sm rounded-md border border-white/15 px-3 py-1.5 hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
