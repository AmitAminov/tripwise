# TripWise — Build Status

_Live status board. What works, what's still open, what QA flagged._

## Current state (2026-07-01, after spec close-out + QA pass)

### Working end-to-end

| Surface | Status | Notes |
|---|---|---|
| Sign in (magic link) | ✅ | Supabase Auth, PKCE flow, open-redirect protected |
| Trips CRUD + members | ✅ | RLS enforces membership |
| Invite flow | ✅ | `/join/[token]` → `accept_invite` RPC |
| Home + planning-depth selector | ✅ | 3 depth modes; all wired |
| **Adaptive survey (all 3 depths)** | ✅ | Plan Now (5 Qs), Intermediate + Deep Research (12–25 Qs) using shared IntermediateSurvey component |
| Destination detail (Bangkok/Prague/S.Italy) | ✅ | Editorial hero + Nano Banana image |
| Compare (ranked when intent present) | ✅ | Full destination_score formula; mobile overflow fixed |
| **Decision arena (couples reveal mechanic)** | ✅ | RLS-enforced independent rating + delayed reveal |
| **Itinerary builder** | ✅ | Day-by-day; requires 002 migration |
| **Interactive map** | ✅ | Maps JS with attraction + day-plan pins, day filter |
| **Pricing dashboard** | ✅ | Aggregates flights (live) + lodging + food + activities + events + transport + insurance + buffer; comfort switcher |
| **Real flight prices (fast-flights)** | ✅ | Prices normalized to USD via FX (open.er-api.com, 24h cache) |
| **Real attractions/restaurants** | ✅ | Google Places (New) |
| **Hotel estimates + deep links** | ✅ | Booking / Airbnb / Hostelworld — pre-filled search URLs, no scraping |
| **Curated events** | ✅ | Recurring festivals for Sep-Nov 2026 in the three destinations |
| **AI day-planner (grounded)** | ✅ | Fetches top Places → feeds into Gemini prompt with "prefer these" instruction; drafts marked "[AI draft]" |
| **Nano Banana hero images** | ✅ | Pre-generated for the 3 destinations |
| **Calendar export** | ✅ | GIS token flow; POST /api/calendar/export |

### QA report summary

Full audit output preserved in git commit `8d7c290`. Highlights:

- **Critical**: none
- **High** (all fixed): open-redirect on `/auth/callback`, survey field drop-through, stale flights caption, table overflow on mobile
- **Medium** (fixed): destination prefill on `/trips/new`, AI draft provenance tag in notes, Fraunces axes
- **Low / polish**: minor UX items, live-error handling in server actions, loading.tsx per route, dead branch cleanup
- **Testing**: neither Vitest nor Playwright installed yet — estimated 2h + 4-6h respectively

### Blocked / open

| Item | Blocker | Notes |
|---|---|---|
| `002_itinerary.sql` migration | Manual: paste into Supabase SQL Editor | Trip plan + Calendar + AI drafts show a "migration not applied" banner otherwise |
| Live event inventory | Optional Ticketmaster / PredictHQ key | Curated seed works today for the three destinations |
| Real hotel inventory | Optional LiteAPI or RateHawk | Deep links + estimates work today |
| Geocoding any city name | Google Geocoding API enabled ✅ (not yet wired in code) | Only Bangkok / Prague / South Italy resolve to coords right now |
| Vitest test suite | Not installed | ~2h scope |
| Playwright E2E | Not installed | ~4-6h scope |
| Deep Research background worker | Redis + BullMQ / Cloudflare Queue | Deep survey exists but processes synchronously |
| Currency conversion for anything but flights | Only fast-flights uses `lib/fx.ts` | Reuse pattern when other providers ship non-USD prices |

## The concrete test case (unchanged)

- Origin: Tel Aviv (TLV)
- Window: one week between 15 Sep and 10 Oct 2026
- Travelers: 2 adults (couple)
- Candidates: Bangkok, Prague, South Italy

## Migrations to apply

1. [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) — you've applied this (auth works)
2. [`supabase/migrations/002_itinerary.sql`](supabase/migrations/002_itinerary.sql) — apply to unblock Day plan / AI drafts / Calendar export

## How to run

```sh
# Terminal 1 — flights microservice (needed for live prices)
cd python-services/flights
C:\Users\ADMIN\virtual_environments\research\Scripts\python.exe -m uvicorn main:app --port 8001 --reload

# Terminal 2 — Next.js
bun run dev
```

Then http://localhost:3000.

## Demo walkthrough (tonight)

1. **Home** — three Nano Banana destination hero cards + planning-depth cards
2. **Take Plan Now (or Intermediate)** — real ranking on `/compare` with scoring reasons + concerns per destination
3. **Click a destination** — editorial detail with cost breakdown sidebar
4. **Save to a trip** — `/trips/new` now pre-filled with the destination
5. **Trip page** — 9 surfaces, all clickable
6. **Flights** — real Google Flights prices in USD (need uvicorn on 8001)
7. **Attractions** — real Google Places cards with photos + ratings
8. **Hotels** — comfort-scaled estimates + deep links to Booking/Airbnb/Hostelworld
9. **Events** — curated recurring festivals for your travel window
10. **Decisions** — the reveal mechanic. Two-window test: sign in as second account (private window), rate the same options, watch the reveal fire when both are done
11. **Day plan** — ✨ Draft with AI (Gemini grounded on real Places), then Export to Google Calendar
12. **Map** — attractions and day-plan items as pins, filter by day
13. **Pricing dashboard** — aggregated total with live-vs-estimated per line item

## Repo tour

```
tripwise/
├── app/                         — Next.js App Router (20 routes)
│   ├── page.tsx                — home
│   ├── login/                  — magic-link auth
│   ├── survey/[depth]/         — plan_now / intermediate / deep_research
│   ├── compare/                — ranked comparison
│   ├── destinations/[id]/      — destination detail with Nano Banana hero
│   ├── join/[token]/           — accept invite
│   ├── api/calendar/export/    — server-side Calendar API sink
│   └── trips/
│       ├── page.tsx            — list your trips
│       ├── new/                — create (pre-fills from ?destination=)
│       └── [id]/
│           ├── page.tsx        — trip overview + tab surfaces
│           ├── flights/        — real prices, USD-normalized
│           ├── attractions/    — Google Places, kind filter
│           ├── hotels/         — comfort-scaled + deep links
│           ├── events/         — curated recurring festivals
│           ├── plan/           — day-by-day itinerary
│           ├── map/            — Maps JS with pins + day filter
│           ├── pricing/        — aggregated dashboard
│           └── decisions/      — couples decision arena (reveal IP)
├── components/                 — shared UI (header, hero card, calendar button, cost breakdown, etc.)
├── data/destinations.ts        — Bangkok/Prague/S.Italy seed
├── lib/
│   ├── ai/gemini.ts            — server-only Gemini text client
│   ├── format.ts               — currency + date helpers
│   ├── fx.ts                   — free FX conversion with 24h cache
│   ├── scoring.ts              — destination_score formula
│   ├── types/trip-intent.ts    — TripIntent + PriceEstimate
│   ├── supabase/               — 3 clients (browser / server / middleware)
│   └── providers/              — provider abstraction
│       ├── types.ts            — port interfaces
│       ├── index.ts            — factories (real vs mock/null)
│       ├── flights/            — mock + fast-flights impls
│       ├── places/             — google impl
│       ├── hotels/             — deep-link estimator
│       ├── events/             — curated seed
│       └── images/             — Gemini Nano Banana
├── public/destinations/        — pre-generated Nano Banana heroes
├── python-services/flights/    — FastAPI wrapper around fast-flights
├── scripts/generate-heroes.ts  — Bun script to regenerate hero images
├── supabase/migrations/        — 001_init + 002_itinerary
└── types/google.d.ts           — window.google ambient types (GIS + Maps SDK)
```

## Original office-hours design doc

Kept at [`~/.claude/plans/federated-popping-llama.md`](C:/Users/ADMIN/.claude/plans/federated-popping-llama.md). The Approach B "Trip Arena" scope was superseded on 2026-07-01 by the full trip-planner spec, but the couples decision-arena reveal mechanic — the original IP — is live inside the bigger app.
