import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Fetch the current user without ever throwing. `supabase.auth.getUser()`
 * hits the GoTrue endpoint over the network; when Supabase is unreachable
 * (paused free-tier project, DNS failure, VPN flap) it either rejects or
 * returns an AuthRetryableFetchError — both of which crash a Server
 * Component with the red overlay.
 *
 * Public pages (home, survey, compare, destination detail) render fine
 * for a logged-out visitor, so a DB outage should degrade them to the
 * signed-out view, not a crash. Use this instead of a bare getUser()
 * on any page that can render without a user.
 */
export async function safeGetUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
            // when middleware is refreshing the session.
          }
        },
      },
    },
  );
}
