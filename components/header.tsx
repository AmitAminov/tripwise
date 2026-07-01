import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Header({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]/60 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-[color:var(--color-fg)]"
        >
          TripWise
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/compare"
            className="text-[color:var(--color-fg-2)] hover:text-[color:var(--color-primary)] hidden sm:inline"
          >
            Compare
          </Link>
          {email && (
            <Link
              href="/trips"
              className="text-[color:var(--color-fg-2)] hover:text-[color:var(--color-primary)]"
            >
              My trips
            </Link>
          )}
          {email ? (
            <>
              <span className="text-[color:var(--color-muted)] hidden md:inline">
                {email}
              </span>
              <form action={logout}>
                <button type="submit" className="btn btn-ghost">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
