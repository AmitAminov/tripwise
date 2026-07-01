# TripWise — Build Status

_Live status board, updated inline as work lands. Source of truth for
"what works right now vs. what's blocked."_

## Current state (2026-07-01)

### Working end-to-end

| Surface | Status | Notes |
|---|---|---|
| Sign in (magic link) | ✅ Live | Supabase Auth, PKCE flow |
| Trips CRUD + members | ✅ Live | With RLS enforcing membership |
| Invite flow | ✅ Live | `/join/[token]` → `accept_invite` RPC |
| Home + planning-depth selector | ✅ Live | 3 depth modes; Plan Now fully wired |
| Adaptive survey (Plan Now, 5 Qs) | ✅ Live | Intermediate + Deep Research are stubs |
| Destination detail (Bangkok/Prague/S.Italy) | ✅ Live | Editorial hero, quick facts, cost breakdown |
| Compare view (ranked when intent present) | ✅ Live | Uses spec's scoring formula |
| Destination scoring | ✅ Live | `lib/scoring.ts` |
| Provider abstraction (Flights/Places/Events/Hotels/Images/Weather) | ✅ Live | Ports in `lib/providers/types.ts` |
| **Real flight prices** via fast-flights | ✅ Live | Python FastAPI service on :8001 |
| Google Places code (attractions/restaurants) | ✅ Written | Waiting on API-enable + key restriction fix |

### Blocked on your side

| Item | Blocker | Fix |
|---|---|---|
| Attractions / restaurants | Places API (New) disabled on Cloud project | [Enable it](https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=637627723925) + relax key restrictions |
| Routes API (day plan travel times) | API disabled | [Enable it](https://console.developers.google.com/apis/api/routes.googleapis.com/overview?project=637627723925) |
| Geocoding (any city → coords) | API disabled | [Enable it](https://console.developers.google.com/apis/api/geocoding-backend.googleapis.com/overview?project=637627723925) |
| Maps JavaScript API (embedded maps) | API disabled | [Enable it](https://console.developers.google.com/apis/api/maps-backend.googleapis.com/overview?project=637627723925) |
| Gemini image gen (Nano Banana) | Generative Language API disabled + API_KEY_SERVICE_BLOCKED | Either enable Generative Language API + open restrictions, or get dedicated key at https://aistudio.google.com/apikey |
| Google Calendar export | Requires OAuth 2.0 Client ID (not just an API key) | Cloud Console → Credentials → Create OAuth Client ID (web app) → put id+secret in `.env.local` |
| Real hotel prices | No API key yet (Booking is partner-gated) | LiteAPI or RateHawk. Or paste-URL fallback works today. |
| Real events | No API key yet | Ticketmaster free API + optional PredictHQ |

### Not yet started

- Itinerary builder (drag saved items into days)
- Decision arena UI (the reveal mechanic — original office-hours "IP")
- Interactive map view
- Google Calendar export
- AI day-planner (Claude API)
- Playwright end-to-end tests
- Vitest unit tests
- Mobile-specific polish

## Concrete test case

Every mock / seed value is dialed for:

- **Origin:** Tel Aviv (TLV)
- **Window:** one week between 15 Sep and 10 Oct 2026
- **Travelers:** 2 adults (couple)
- **Candidates:** Bangkok, Prague, South Italy

## Architecture

```
Next.js 15 (App Router) + React 19 + Tailwind v4
     │
     ├─ Supabase (Auth via magic link, Postgres, RLS)
     │
     ├─ Provider abstraction (lib/providers/*)
     │    ├─ Flights → fast-flights microservice (Python FastAPI on :8001)
     │    ├─ Places  → Google Places API (New)  [pending enable]
     │    ├─ Events  → null (TODO)
     │    ├─ Hotels  → null (TODO)
     │    ├─ Images  → null (TODO Gemini)
     │    └─ Weather → null (TODO)
     │
     └─ Design system: warm neutrals + navy/green/gold, Inter + Fraunces
```

## How to run

```sh
# Terminal 1 — flights microservice
cd python-services/flights
C:\Users\ADMIN\virtual_environments\research\Scripts\python.exe -m uvicorn main:app --port 8001 --reload

# Terminal 2 — Next.js
bun run dev
```

Then http://localhost:3000.

## Original office-hours design doc

Kept for the record at [`../../.claude/plans/federated-popping-llama.md`](C:/Users/ADMIN/.claude/plans/federated-popping-llama.md).
The Approach B "Trip Arena" scope was superseded by the 2026-07-01 pivot
to the full trip-planner + destination-comparison spec. The decision
arena remains on the roadmap (see "Not yet started"); the couples
reveal mechanic is still the differentiator vs. Wanderlog etc., just now
inside a richer app rather than the whole app.
