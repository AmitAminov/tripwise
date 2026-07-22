import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() refreshes the auth token if needed.
  //
  // Wrapped in try/catch so a Supabase outage — paused free-tier project,
  // DNS failure, VPN flap, provider downtime — degrades gracefully instead
  // of throwing an uncaught `AuthRetryableFetchError` on EVERY request
  // (which surfaces as the red Next.js error overlay + console spam on
  // every page, including fully-public ones). On failure we just proceed
  // with no refreshed session: public pages render, auth-gated pages fall
  // through to their own `if (!user) redirect("/login")` guard. Matches
  // the project rule "a provider outage should degrade the surface, not
  // crash the page."
  try {
    await supabase.auth.getUser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // One concise line instead of a multi-frame stack per request.
    console.warn(
      `[middleware] Supabase auth unreachable (${msg}). ` +
        `Proceeding without a refreshed session. If this persists, the ` +
        `Supabase project may be paused — restore it in the dashboard.`,
    );
  }

  return supabaseResponse;
}
