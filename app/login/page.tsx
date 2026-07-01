"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const errorDetail = params.get("detail");
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--color-bg)]">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl mb-1">TripWise</h1>
        <p className="text-[color:var(--color-fg-2)] mb-8">
          Decide together. We&apos;ll email you a magic link.
        </p>

        {state.sent ? (
          <div className="card p-4 text-sm">
            Check your inbox. Click the link to sign in.
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="field-label">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="field"
              />
            </label>

            {state.error && (
              <p className="text-sm text-[color:var(--color-danger)]">
                {state.error}
              </p>
            )}
            {errorDetail && !state.error && (
              <p className="text-sm text-[color:var(--color-danger)]">
                Sign-in failed: {errorDetail}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary w-full"
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
