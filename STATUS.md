# TripWise — Build Status

_Live status board. What works right now vs. what's blocked, updated inline._

## Current state (2026-07-01)

### Working end-to-end (no external APIs needed)

| Surface | Status | Notes |
|---|---|---|
| Sign in (magic link) | ✅ Live | Supabase Auth, PKCE flow |
| Trips CRUD + members | ✅ Live | RLS enforces membership |
| Invite flow | ✅ Live | `/join/[token]` → `accept_invite` RPC |
| Home + planning-depth selector | ✅ Live | 3 depth modes; Plan Now fully wired |
| Adaptive survey (Plan Now, 5 Qs) | ✅ Live | Intermediate + Deep Research are guided stubs |
| Destination detail (Bangkok/Prague/S.Italy) | ✅ Live | Editorial hero, quick facts, cost breakdown |
| Compare (ranked when intent present) | ✅ Live | Spec's scoring formula |
| **Decision arena (the original office-hours IP)** | ✅ Live | Independent rating + delayed reveal, RLS-enforced |
| **Itinerary builder (day-by-day plan)** | ✅ Live | Requires 002 migration to be applied |
| Provider abstraction (Flights/Places/Events/Hotels/Images/Weather) | ✅ Live | Ports in `lib/providers/types.ts` |

### Working with a running microservice

| Surface | Status | How to run |
|---|---|---|
| **Real flight prices** via fast-flights | ✅ Live | `cd python-services/flights && uvicorn main:app --port 8001` |

### Written, waiting on your side

| Surface | Blocker | Fix (URLs point to your project 637627723925) |
|---|---|---|
| Attractions / restaurants | Places API (New) disabled | [Enable](https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=637627723925) + relax key restrictions |
| Interactive map view | Maps JavaScript API disabled | [Enable](https://console.developers.google.com/apis/api/maps-backend.googleapis.com/overview?project=637627723925) |
| Geocoding (any city → coords) | Geocoding API disabled | [Enable](https://console.developers.google.com/apis/api/geocoding-backend.googleapis.com/overview?project=637627723925) |
| Routes (day plan travel times) | Routes API disabled | [Enable](https://console.developers.google.com/apis/api/routes.googleapis.com/overview?project=637627723925) |
| Gemini image gen (Nano Banana) | Need valid `AIza...` (39 chars) from https://aistudio.google.com/apikey | Provided token was 32 chars — wrong format |
| Real hotel prices | No API key yet (Booking is partner-gated) | LiteAPI or RateHawk; paste-URL fallback works today |
| Real events | No API key yet | Ticketmaster free API |
| Google Calendar export | Requires OAuth 2.0 Client ID (not just an API key) | Cloud Console → Credentials → Create OAuth Client ID (web app) |

### Not yet started

- Interactive map view (waiting on Maps JS API)
- AI day-planner (Claude API — will use ANTHROPIC_API_KEY)
- Currency conversion for fast-flights results (ILS → USD normalization)
- Playwright end-to-end tests + Vitest unit tests
- Mobile-specific polish
- Trip poster generator (Gemini)

## The concrete test case

Every mock / seed value is dialed for:

- **Origin:** Tel Aviv (TLV)
- **Window:** one week between 15 Sep and 10 Oct 2026
- **Travelers:** 2 adults (couple)
- **Candidates:** Bangkok, Prague, South Italy

## Migrations to apply

Run these in the Supabase SQL Editor (once each, in order):

1. [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) — auth-adjacent tables, trips, decisions, options, ratings, RLS, reveal trigger
2. [`supabase/migrations/002_itinerary.sql`](supabase/migrations/002_itinerary.sql) — itinerary_items + RLS

## How to run

```sh
# Terminal 1 — flights microservice (needed for real prices)
cd python-services/flights
C:\Users\ADMIN\virtual_environments\research\Scripts\python.exe -m uvicorn main:app --port 8001 --reload

# Terminal 2 — Next.js
bun run dev
```

Then http://localhost:3000.

## Demo walkthrough

1. **Sign in** at `/login` (magic link → your inbox)
2. **Home** shows the three destination hero cards + planning-depth cards
3. **Take the Plan Now survey** → land on `/compare` with real scores ranking Bangkok / Prague / South Italy against your interests + budget
4. **Click a destination** → editorial detail with cost breakdown
5. **Create a trip** (e.g., "Prague, Oct 6-13") from `/trips/new`
6. **Invite your partner** from the trip detail page (or open a private window and sign in as a second account to test both sides)
7. **From the trip detail**, click **Flights** → real Google-Flights-scraped offers (requires uvicorn)
8. **Click Decisions** → create "Where do we eat Tuesday?" → add 3-4 options → rate them → invite partner rates → the reveal fires automatically once you both finish
9. **Click Day plan** → add items per day/slot

## Repo tour

```
tripwise/
├── app/                        — Next.js App Router
│   ├── (auth via middleware)/
│   ├── page.tsx               — home
│   ├── login/                 — magic-link auth
│   ├── survey/[depth]/        — adaptive questionnaire
│   ├── compare/               — ranked destination comparison
│   ├── destinations/[id]/     — destination detail
│   ├── join/[token]/          — accept invite
│   └── trips/
│       ├── page.tsx           — list your trips
│       ├── new/
│       └── [id]/
│           ├── page.tsx       — trip overview
│           ├── flights/       — real prices via fast-flights
│           ├── attractions/   — Google Places (kind filter)
│           ├── decisions/     — decision arena
│           └── plan/          — day-by-day itinerary
├── components/                — shared UI
├── data/destinations.ts       — Bangkok/Prague/S.Italy seed
├── lib/
│   ├── format.ts              — currency + date helpers
│   ├── scoring.ts             — destination_score = ...
│   ├── types/trip-intent.ts   — TripIntent + PriceEstimate
│   ├── supabase/              — 3 clients (browser / server / middleware)
│   └── providers/             — provider abstraction
│       ├── types.ts           — port interfaces
│       ├── index.ts           — factories (real vs mock)
│       ├── flights/           — mock + fast-flights impls
│       └── places/            — google impl
├── python-services/flights/   — FastAPI wrapper around fast-flights
└── supabase/migrations/       — 001_init + 002_itinerary
```

## Original office-hours design doc

Kept at [`~/.claude/plans/federated-popping-llama.md`](C:/Users/ADMIN/.claude/plans/federated-popping-llama.md). The Approach B "Trip Arena" scope was superseded on 2026-07-01 by the full trip-planner + destination-comparison spec, but the decision arena's reveal mechanic — the original IP — is now live inside the bigger app.
