# TripWise — Build Status

_Live status board — what's shipped, what's queued, what needs your hand._

## Current state (2026-07-02 — after Routes + Save-to-arena + SWR + Playwright)

### Working end-to-end

| Surface | Status | Notes |
|---|---|---|
| Sign in (magic link, PKCE, open-redirect protected) | ✅ | Supabase Auth |
| Trips CRUD + invite + members | ✅ | RLS enforces membership |
| Home + Nano Banana destination heroes | ✅ | Pre-generated PNGs |
| **Adaptive survey (all 3 depths)** | ✅ | Plan Now 5 Qs, Intermediate + Deep Research 12–25 Qs, all fields persist |
| Compare (ranked when intent present) | ✅ | Full destination_score formula |
| Destination detail (Bangkok/Prague/S.Italy) | ✅ | Editorial hero + cost sidebar |
| **Real flight prices** via fast-flights, USD-normalized | ✅ | Local Python service on :8001 |
| **Attractions / restaurants / cafés / bars** | ✅ | Google Places (New) |
| **Hotels — comfort-scaled estimates + deep links** | ✅ | Booking / Airbnb / Hostelworld pre-filled |
| **Curated events** | ✅ | Recurring festivals Sep-Nov 2026 |
| **Day plan with AI drafts** | ✅ | Gemini grounded on real Places; items geocoded on insert |
| **Google Routes walking-time chips** | ✅ | Legs computed per day between consecutive items with coords |
| Interactive Google Map | ✅ | Pins + day filter |
| **Pricing dashboard** | ✅ | Aggregated flights + lodging + food + activities + events + transport + insurance + buffer |
| **AI Visuals** | ✅ | Nano Banana mood board + trip poster, 6h cache, per-user rate cap |
| **Decision arena (reveal mechanic)** | ✅ | RLS-enforced independent rating + delayed reveal |
| **Save to arena** from flights / hotels / attractions | ✅ | One-click composite decision creation |
| Calendar export | ✅ | GIS token flow |
| Geocoding (any city) | ✅ | Google Geocoding API |

### Reliability & performance layers

| Layer | Notes |
|---|---|
| Provider abstraction | Every port returns `ProviderResult<T>` with `status: estimated / live_checked / cached / error`; factories degrade to null when keys absent |
| Timeouts per spec | Places 3s, Routes 4s, Flights 8s, Events 5s, Calendar 8s, Image 30s |
| **SWR cache wired** into Routes, Places (search + detail), LiteAPI hotels, PredictHQ events — cached serves stale while background revalidates, coalesces concurrent misses |
| **Routes parallelized** — day-plan legs fire concurrently instead of sequentially (was N×4s worst case, now one RTT) |
| Loading states | `loading.tsx` on every dynamic trip surface: flights / attractions / hotels / events / pricing / map / plan / visuals / decisions |
| Currency conversion | `lib/fx.ts` normalizes fast-flights (ILS→USD etc) via open.er-api.com, 24h cache, fallback rates if unreachable |
| Error surfacing | Every page shows a friendly card when an upstream API returns 4xx/5xx; plan page surfaces per-day "walking times unavailable" when Routes fails |

### Testing

| Layer | Status |
|---|---|
| **Vitest unit** | ✅ **47/47 passing**: scoring, FX, format, curated events, hotels, SWR cache |
| **Playwright E2E scaffold** | ✅ Config + 5 smoke tests written. Run: `bunx playwright install chromium` then `bun run test:e2e` (with `bun run dev` in another terminal). |
| Coverage target | ~80% of `lib/` covered by unit tests; Vitest coverage command wired |

### Blocked / open

| Item | Blocker |
|---|---|
| `002_itinerary.sql` migration | Manual paste into Supabase SQL Editor (30 sec) — otherwise Day plan / AI drafts / Calendar export show a "migration not applied" banner |
| Live event inventory | Optional Ticketmaster / PredictHQ key — curated seed works today |
| Real hotel inventory (vs. deep links + estimates) | Optional LiteAPI or RateHawk |
| Redis / durable cache | In-memory SWR is the current sub. Swap when scale demands. |
| Deep Research true background worker | Currently sync. Redis + BullMQ would swap in. |
| Bulk browser install for Playwright | ~120 MB one-time: `bunx playwright install chromium` |

## The concrete test case (unchanged)

- Origin: Tel Aviv (TLV)
- Window: one week between 15 Sep and 10 Oct 2026
- Travelers: 2 adults (couple)
- Candidates: Bangkok, Prague, South Italy

## Migrations to apply

1. [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) — you've applied this
2. [`supabase/migrations/002_itinerary.sql`](supabase/migrations/002_itinerary.sql) — apply to unblock Day plan / AI drafts / Calendar export

## How to run

```sh
# Terminal 1 — flights microservice (needed for live prices)
cd python-services/flights
C:\Users\ADMIN\virtual_environments\research\Scripts\python.exe -m uvicorn main:app --port 8001 --reload

# Terminal 2 — Next.js
bun run dev

# Terminal 3 — tests
bun run test          # 47 Vitest unit tests
bunx playwright install chromium   # one-time
bun run test:e2e      # 5 smoke tests (requires Next running)
```

Then http://localhost:3000.

## Demo walkthrough

1. **Home** — three Nano Banana destination hero cards + planning-depth cards
2. **Take Intermediate survey** — 12–18 questions; ranked results on `/compare` with reasons + concerns per destination
3. **Click a destination** — editorial detail with cost breakdown sidebar; "Save to a trip" pre-fills `/trips/new`
4. **Trip detail** — 10 tab surfaces:
   - **Flights** — live Google Flights prices in USD, "Compare top 4 in arena →" button
   - **Attractions / Restaurants** — real Google Places, "Compare top 6 in arena →" button
   - **Hotels** — comfort-scaled + deep links, "Compare N areas in arena →" button
   - **Events** — curated recurring festivals for your travel window
   - **Day plan** — ✨ AI Draft (Gemini + Places); items geocoded on insert; walking-time chips between items
   - **Map** — Maps JS with pins + day filter
   - **Pricing dashboard** — aggregated total with live-vs-estimated per line item
   - **AI Visuals** — Nano Banana editorial hero + food + architecture + trip poster
   - **Decisions** — the reveal mechanic
5. **Two-window test** — sign in as a second account (private window), rate the same options, watch the reveal fire when both finish
6. **Export to Google Calendar** button on Day plan

## Repo tour

```
tripwise/
├── app/                        — Next.js App Router (21 routes)
│   ├── page.tsx                — home
│   ├── login/                  — magic-link auth
│   ├── survey/[depth]/         — plan_now / intermediate / deep_research
│   ├── compare/                — ranked comparison
│   ├── destinations/[id]/      — destination detail with Nano Banana hero
│   ├── join/[token]/           — accept invite
│   ├── api/calendar/export/    — server-side Calendar API sink
│   ├── api/images/generate/    — Gemini image proxy w/ rate cap + cache
│   └── trips/
│       ├── page.tsx            — list your trips
│       ├── new/                — create (pre-fills from ?destination=)
│       └── [id]/
│           ├── page.tsx        — trip overview + tab surfaces
│           ├── flights/        — real prices + Save-to-arena
│           ├── attractions/    — Google Places + Save-to-arena
│           ├── hotels/         — comfort-scaled + deep links + Save-to-arena
│           ├── events/         — curated recurring festivals
│           ├── plan/           — day-by-day itinerary + Routes + AI Draft + Calendar export
│           ├── map/            — Maps JS with pins + day filter
│           ├── pricing/        — aggregated dashboard
│           ├── visuals/        — Nano Banana mood board + trip poster
│           └── decisions/      — couples decision arena (reveal IP)
├── components/                 — shared UI
├── data/destinations.ts        — Bangkok/Prague/S.Italy seed
├── lib/
│   ├── ai/gemini.ts            — server-only Gemini text client
│   ├── format.ts               — currency + date helpers
│   ├── fx.ts                   — free FX conversion w/ 24h cache
│   ├── swr-cache.ts            — generic stale-while-revalidate
│   ├── scoring.ts              — destination_score formula
│   ├── geocoding.ts            — Google Geocoding
│   ├── destination-coords.ts   — shared resolver (seed → geocoding)
│   ├── image-prompts.ts        — centralized Nano Banana prompts
│   ├── types/trip-intent.ts    — TripIntent + PriceEstimate
│   ├── supabase/               — 3 clients (browser / server / middleware)
│   └── providers/              — provider abstraction
│       ├── types.ts            — port interfaces
│       ├── index.ts            — factories (real vs mock/null)
│       ├── flights/            — mock + fast-flights impls
│       ├── places/             — google impl
│       ├── routes/             — google impl
│       ├── hotels/             — deep-link estimator
│       ├── events/             — curated seed
│       └── images/             — Gemini Nano Banana
├── public/destinations/        — pre-generated Nano Banana heroes
├── python-services/flights/    — FastAPI wrapper around fast-flights
├── scripts/generate-heroes.ts  — Bun script to regenerate hero images
├── supabase/migrations/        — 001_init + 002_itinerary
├── tests/                      — 47 Vitest unit tests
├── e2e/                        — 5 Playwright smoke tests
└── types/google.d.ts           — window.google ambient (GIS + Maps SDK)
```

## Commit history highlights

- `0fe15ea` — Routes + Save-to-arena + SWR + Playwright
- `ed71177` — AI Visuals (Nano Banana mood board + poster)
- `cb66d42` — Vitest + Geocoding + Routes provider + loading
- `d0c470e` — STATUS update
- `8d7c290` — QA agent fixes
- `b725251` — Spec close-out
- `b016a73` — Nano Banana heroes
- `57ea630` — Calendar export
- `7e4a551` — AI day-planner + Gemini
- `aa14596` — Decision arena + itinerary
- `791d145` — Google Places
- `c9d36b7` — Fast-flights integration
- `03b59cb` — v3 shell / full pivot to trip planner
- `1306466` — Day 2: trips + invite
- `931f6af` — Day 1: scaffold + auth

## Original office-hours design doc

Kept at [`~/.claude/plans/federated-popping-llama.md`](C:/Users/ADMIN/.claude/plans/federated-popping-llama.md). The Approach B "Trip Arena" scope was superseded by the full trip-planner spec, but the couples decision-arena reveal mechanic — the original IP — is live inside the bigger app and now accessible via one-click "Save to arena" from flights, hotels, and attractions.
