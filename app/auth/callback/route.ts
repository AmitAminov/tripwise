import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

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
