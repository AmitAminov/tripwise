"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const errorDetail = params.get("detail");
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">TripWise</h1>
        <p className="text-[color:var(--color-muted)] mb-8">
          Decide together. We&apos;ll email you a magic link.
        </p>

        {state.sent ? (
          <div className="rounded-lg border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 p-4 text-sm">
            Check your inbox. Click the link to sign in.
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="block text-sm mb-2 text-[color:var(--color-muted)]">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 focus:outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>

            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}
            {errorDetail && !state.error && (
              <p className="text-sm text-red-400">
                Sign-in failed: {errorDetail}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-[color:var(--color-accent)] text-black font-medium py-2.5 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
