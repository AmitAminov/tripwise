# TripWise

A couples decision arena for trip planning. Independent rating, delayed reveal.
Built for an autumn 2026 trip. Design doc:
[../.claude/plans/federated-popping-llama.md](C:/Users/ADMIN/.claude/plans/federated-popping-llama.md)

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind v4
- Supabase (Auth via magic link, Postgres, Row Level Security)
- Bun (runtime + package manager)
- Vercel (deploy)

## One-time setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, create a project.
   Region: pick one close to you. Save the database password somewhere.
2. Wait ~2 min for provisioning.
3. Settings → API:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Configure auth redirect

Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/auth/callback`
  (add the production equivalent when you deploy)

### 3. Run the schema migration

SQL Editor → New query → paste the contents of
[supabase/migrations/001_init.sql](supabase/migrations/001_init.sql) → Run.

This creates: `profiles`, `trips`, `trip_members`, `trip_invites`,
`decisions`, `options`, `ratings`, plus enums, RLS policies, and the
reveal trigger. Idempotent on first run; re-running requires dropping
the public schema first.

### 4. Env vars

```bash
cp .env.local.example .env.local
# then edit .env.local with your real values
```

## Run

```bash
bun install
bun run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Verifying Day 1

End-to-end check that auth works:

1. Visit http://localhost:3000 → redirects to `/login`
2. Enter your email, click "Send magic link"
3. Open the email Supabase sent → click the link
4. You should land back on the app at `/`, signed in, seeing your email
5. Click "Sign out" → back to `/login`

If any step breaks, fix that before starting Day 2.

## Where we are

- [x] **Day 1** — Foundation: scaffold, auth, sign-in/out
- [ ] **Day 2** — Trips + invite flow
- [ ] **Day 3** — Decisions + options
- [ ] **Day 4** — The reveal mechanic (the IP)
- [ ] **Day 5** — Polish + decided state
- [ ] **Day 6-7** — Use it for the actual trip
