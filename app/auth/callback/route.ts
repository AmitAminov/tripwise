import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow same-origin relative paths so ?next=//evil.com and
 * ?next=/\\evil.com don't turn the magic-link redirect into an open
 * redirect vulnerability.
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  // PKCE flow — Supabase's default magic-link email lands here with ?code=...
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(
      new URL(
        `/login?error=verify_failed&detail=${encodeURIComponent(error.message)}`,
        origin,
      ),
    );
  }

  // Token-hash flow — used when the email template is customized per the
  // @supabase/ssr guide (URL of form ?token_hash=...&type=...).
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(
      new URL(
        `/login?error=verify_failed&detail=${encodeURIComponent(error.message)}`,
        origin,
      ),
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=verify_failed&detail=missing_params", origin),
  );
}
