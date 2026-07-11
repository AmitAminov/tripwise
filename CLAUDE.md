# TripWise — Instructions for Claude

Couples decision arena for planning a real trip. Every day of the plan
is a chunk of multiple-choice questions filled from real data
(Places / events / weather). Autumn 2026 test case: one week
international, single destination, two travelers.

Design doc: `~/.claude/plans/federated-popping-llama.md` (initial
brainstorm — the app has moved past parts of it, but the "async
independent ratings + delayed reveal" mechanic is still the north star
for trip-wide decisions).

---

## Stack

- **Next.js 15 App Router + React 19** — RSC + Server Actions
  everywhere. All data mutations go through Server Actions, not
  route handlers.
- **Bun** for install / dev / test. `bun run dev`, `bun run test`,
  `bunx tsc --noEmit`.
- **Supabase** — Postgres + RLS + magic-link auth. Server client via
  `@supabase/ssr` in `lib/supabase/server.ts`.
- **Tailwind v4** — CSS variables as design tokens in
  `app/globals.css` (`--color-primary`, `--color-fg`, `--radius`, …).
  Use `.card`, `.btn`, `.chip`, `.field`, `.status-*` component classes
  before reaching for utilities.
- **Vitest** — 58 tests, all green as of the last audit. `bun run
  test`. No E2E in CI; Playwright is present but flaky.
- **Node scripts**: `scripts/load-secrets.mjs` runs before `next dev/
  build/start` to fetch server secrets from GCP Secret Manager and
  inject them into the child process env. Never bypass this — see
  Security below.

### External providers

| Provider | Kind | Key env var | Notes |
|---|---|---|---|
| **Google Places (New)** | attractions / restaurants / cafes / bars / patisseries / wineries | `GOOGLE_MAPS_API_KEY` (server) + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client, for Maps JS SDK only) | `lib/providers/places/google.ts`. 50km radius max per API. Regional trips use `searchText`. Every call MUST pass `countryFilter` — see the leak fix below. |
| **Google Maps JS SDK** | client-side map render | same client key | `map-view.tsx` — synchronous loader (no `loading=async`), `gestureHandling: "greedy"` |
| **Google Routes** | walking legs between plan items | `GOOGLE_MAPS_API_KEY` | `lib/providers/routes/google.ts` |
| **Google Geocoding** | free-text → coords | `GOOGLE_MAPS_API_KEY` | via `resolveDestination` in `lib/destination-coords.ts` |
| **Google Calendar** | trip export | short-lived OAuth token from GIS popup | `/api/calendar/export/route.ts` |
| **Gemini 2.5 Flash** | day plan drafts | `GEMINI_API_KEY` | `lib/ai/gemini.ts` |
| **OpenMeteo** | date-window weather on compare | none (free) | `lib/providers/weather/openmeteo.ts` |
| **PredictHQ** | events | `PREDICTHQ_API_KEY` | day-specific window + city |
| **Ticketmaster** | events (layered on PredictHQ) | `TICKETMASTER_API_KEY` | optional |
| **LiteAPI** | hotels catalog | `LITEAPI_API_KEY` | sandbox-safe |
| **Kiwi** | flights | Python microservice (`python-services/flights/`) | out-of-process |

**All provider results are SWR-cached** to disk under `.tripwise-cache/{name}/` via `lib/swr-cache.ts`. Bump the cache-key version prefix (e.g. `v2 → v3` in `places/google.ts:searchKey`) whenever default limits / filters / routing change, or old narrow entries will shadow new wider queries.

---

## Website structure

### Public

- `/` — home, curated 3 hero destinations
- `/compare` — destination picker + weather-window + budget-range
  ranking. `?ids=csv` for the picker, `?intent=<base64url json>` from
  the survey.
- `/destinations/[id]` — hero card + real Places attractions + real
  events. Regional detection via `detectRegionalScope`.
- `/survey/[depth]` — `plan_now` | `intermediate` | `deep_research`.
  All three lead to `/compare?intent=...`.
- `/login` — magic link

### Auth-gated

- `/trips` — user's trip list
- `/trips/new` — creates trip via `create_trip` RPC (see migration 003)
- `/trips/[id]` — trip detail. **Two-column layout**: cornerstones
  left, live Google Maps + KindsPicker right. Sticky map pane.
- `/trips/[id]/plan` — day plan. Each day card renders MCQ choice
  cards (from `decisions` where `day_index IS NOT NULL`) plus a
  "What's on" event strip plus freeform items. "Draft trip with AI"
  fires `draftTripChoices` for every day in parallel batches of 3.
- `/trips/[id]/restaurants` — "Yummy" — 4-column layout (Top / Restaurant / Café & Patisserie / Winery) with sticky column headers and vertical separators. Post-fetches hotels out of the results.
- `/trips/[id]/attractions?kind=X` — Places tabs (attractions | restaurants | cafes | bars)
- `/trips/[id]/map` — full-map route with the KindsPicker. Duplicate of what the trip page renders inline, kept for direct bookmarks; the app UI does not link to it.
- `/trips/[id]/{hotels,flights,events,pricing,visuals,decisions}` — remaining cornerstones
- `/api/calendar/export` — POST-only route handler for calendar export

### Cornerstone order on trip detail

`Plan · Attractions · Yummy · Hotels · Flights · Events · Prices · Mood`. Notes stripped from all except Plan / Prices / Mood.

---

## Security & secrets

- **Server secrets** (`GEMINI_API_KEY`, `LITEAPI_API_KEY`, `PREDICTHQ_API_KEY`, `GOOGLE_MAPS_API_KEY`) live in **GCP Secret Manager** project `radiant-mason-467110-u5`. `scripts/load-secrets.mjs` fetches them at process spawn and hands them to the Next worker as env vars. **DO NOT** create a `.env.local` with the same values — the loader defers to existing env, so a stale `.env.local` will pin an old key.
- **`lib/secrets.ts`** — server-only lazy fallback resolver. Never import from client code (it reads `process.env` and talks to GCP).
- **`instrumentation.ts`** — intentionally a no-op. Importing `@google-cloud/secret-manager` into Next's build graph breaks webpack (Node-only deps: `path`, `http`, `grpc`).
- **`next.config.ts`** lists `@google-cloud/secret-manager` and `google-gax` in `serverExternalPackages` so they never enter the bundle.
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** is exposed to the browser by design (Maps JS SDK requires it client-side). Protect with an HTTP-referrer restriction + API-restriction in the Cloud console. Do not rely on secret storage — it can't hide values the browser needs.
- **Supabase RLS**: every table has RLS on. Never write RLS-bypassing code from the browser. Trip creation goes through the `create_trip` security-definer RPC (migration 003) so `auth.uid()` is derived server-side.
- **`create_trip_rpc`** pattern — use it when the direct INSERT + RLS check race feels fragile. Prefer to bring more mutation flows into RPCs over widening RLS policies.

---

## Code standards

### TypeScript

- Strict mode. `bunx tsc --noEmit` must pass before any commit.
- Prefer discriminated unions over enums.
- Type extraction from ambient globals: use `NonNullable<...>` before conditional `infer` — see `map-view.tsx:GMap` / `GMarker` — else optional-property types collapse to `never`.

### Server / client boundaries

- Any non-component export from a `"use client"` module is a **Server Reference proxy** on the server side. If a server component imports it, calls fail with cryptic errors. Put shared constants in a plain (non-`"use client"`) module — see `app/trips/[id]/map/kinds.ts`.
- Client components pass callbacks + serializable props; server pages do all data fetching.

### Server Actions

- All mutations. Return `{ error?: string; ... }` — throw is caller-facing.
- `revalidatePath("/trips/[id]/...")` after any DB write that the calling page depends on.
- Idempotency — every action that could be double-fired (double-click, background revalidation, retry) MUST no-op cleanly on the duplicate. See `addEventToPlan`, `pickChoice`, `draftDayChoices`.

### Providers

- Every provider returns `ProviderResult<T>` from `lib/providers/types.ts` with `status: "live_checked" | "cached" | "error" | "estimated" | ...`. Never `throw` — a provider outage should degrade the surface, not 500 the page.
- SWR-cache keys must include every dimension that changes the result (radius, limit, regional, country, ...). Bump the version prefix on shape changes.

### Commits

- Atomic. **One concern per commit.** History today is bisectable; keep it that way.
- Message format: `type(scope): short description` first line (≤72 chars), then a body explaining **why**, not what (the diff is the what). Examples:
  - `fix(places): countryFilter + Yummy sticky redesign + cornerstone reorder`
  - `feat(plan): "Draft trip with AI" button drafts every day at once`
- Reference migration files by name in the commit body when the code needs one.

### Regional trips

- Multi-city / country-wide destinations (South Italy, `italy_wide`, `france_wide`, …) MUST go through `detectRegionalScope(id, destinationText)` before hitting the Places provider. Regional calls route through `searchText` (no 50km cap) and MUST include `countryFilter` post-fetch — Places' text search can return semantically-matched places anywhere in the world (see the Tel-Aviv-in-South-Italy leak fixed in `e0e8792`).

---

## QA

- Skills tried in this env: `gstack browse` daemon fails to start (`Server failed to start within 15s`). `/qa` and `/codex chrome` both use it. **Interactive browser QA is unavailable** in this sandbox — every visual claim needs to be verified by the user on their real browser.
- What works instead: HTTP smoke tests via `curl`, code inspection, `bunx tsc --noEmit`, `bun run test`. Every non-trivial commit runs the sweep across the 25 key routes (see the last QA sweep for the URL list).
- Playwright config present but flaky under this shell — do not rely on it in CI.
- Every PR that touches a Places provider must clear `.tripwise-cache/places-search/` locally so it's not benching against stale narrower results.

---

## Skills & methodologies

- `/qa` and `/codex chrome` — pivot to HTTP + code inspection when browse won't start.
- `/design`, `/design-review`, `/plan-design-review` — heavy on context. Use only for a fresh visual pass; for tile / layout tweaks, the design tokens in `globals.css` cover it.
- `/find-skills` — external skill registry. Rarely necessary; gstack already carries QA / review / investigate / ponytail for this codebase.
- `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt` — over-engineering hunt. Worth running before shipping a big refactor.
- **Iterative slice pattern** — big user asks (e.g. "unify Plan+Decisions, add Draft-trip, make everything MCQs") get split into named slices (1, 2, 3a, 3b) with one commit per slice. Any slice must leave the app buildable.
- **Interrupts mid-flight** — the user often adds constraints ("call the button X", "reorder tiles", "rename Restaurants → Yummy") while a bigger change is in progress. Fold the interrupt into the current slice when it's cheap; commit it separately when it's independent.

---

## Website features (audit map)

Everything below is live as of the last sweep.

- **Home**: curated hero destinations, planning-depth selector CTA
- **Compare**: destination picker (grouped by country, tri-state, select-all), country-wide entries, ranked cards with rank + score + budget-range strip, window-specific weather from OpenMeteo, country flags via `flagcdn.com`, "Start planning →" CTA that pre-fills `/trips/new`
- **Survey (all three depths)**: adaptive fields, select-all / unselect-all destination grid, flexible date-window mode, budget range mode, encodes `TripIntent` as base64url and redirects to `/compare?intent=...`
- **Trip creation**: `create_trip` RPC (security definer, migration 003). Falls back to direct INSERT if the RPC isn't installed.
- **Trip detail**: two-column, sticky map on the right with the full KindsPicker (attractions / restaurants / cafés / bars / events) and internal filter chips. Members + invite panels + cornerstones on the left.
- **Plan**: day cards render MCQ choices (from `decisions` where `day_index IS NOT NULL`), event strip, freeform items. Pick one option per MCQ → decision decided + itinerary_item inserted. "Draft trip with AI" (all days) + per-day "Draft with AI" both use `draftDayChoices` from a 3-question bank (morning attraction, lunch restaurant, evening events-or-bars). Walking-time chips between items with coords. "Open in Google Maps →" and "Export to Google Calendar" in header.
- **Yummy** (Restaurants cornerstone): 4-column dedicated page. Top / Restaurant / Café & Patisserie / Winery. Sticky column headers, vertical separators between columns. Hotels filtered out. Regional scope + country filter applied.
- **Attractions**: tabbed (attractions | restaurants | cafes | bars), sends top-6 into decision arena via "Compare in arena".
- **Hotels**: LiteAPI catalog + deep-link estimator fallback.
- **Flights**: Kiwi via Python microservice.
- **Events**: PredictHQ + Ticketmaster composite, curated seed fallback.
- **Pricing**: aggregated estimates.
- **Mood** (AI Visuals): Nano Banana generated hero images.
- **Decisions** (de-emphasized): the older reveal mechanic for trip-wide decisions (hotel, etc.). Day-scoped decisions now render on the Plan page.

---

## Remaining tasks

### Must-do before ship

- **Apply migration `003_create_trip_rpc.sql`** in the Supabase SQL editor. Without it, trip creation falls back to the direct INSERT which can hit the RLS-mismatch failure the RPC was written to fix.
- **Apply migration `004_decision_day_slot.sql`** in the Supabase SQL editor. Without it, day-scoped decisions have nowhere to live and the Plan page's structured-choice mode silently no-ops.
- **Full mobile QA** on the two-column trip detail — I only smoke-tested via HTTP.
- **Real browser QA** of the map: pan / zoom (should be plain-scroll now), pin clicks, filter chips, kinds picker round-trip through `?kinds=` URL param.

### Known deferred / partial

- **`flightFromTLV` field name** is a leftover from the initial Tel-Aviv-first design. Semantics still hold (typical duration from origin airport) but the name misleads. Rename to `typicalFlight` and update callers when time permits.
- **`defaultTripIntent()`** hardcodes `IL / TLV / Tel Aviv`. Should come from the user's profile or a "where are you flying from?" onboarding step.
- **Deep-research background job** in `lib/deep-research/queue.ts` — infrastructure in place, but no worker consumes it. Deep-research surveys still go through the same synchronous compare path as intermediate.
- **Full reveal-mechanic UI for MCQ choices** — right now a pick immediately decides. To honor the "independent ratings + delayed reveal" spec on day plans too, each option would need per-user ratings and a reveal transition. Currently only the standalone `/trips/[id]/decisions/[did]` page does the reveal.
- **Un-picking an MCQ choice** — the `[choice:{decisionId}]` tag lets `pickChoice` swap the winner cleanly, but there's no "clear my pick" UI. Delete the item to un-pick as a workaround.
- **`draftDayChoices` isn't event-live for evening picks after Day 0** — the events fetch uses `dayIndex` to offset from `trip.start_date` (or `Date.now()` fallback), which drifts if events cover a longer window than the trip. Verify on a trip with events on days 2-6 that they surface.
- **Country filter on `resolveDestination` geocoded destinations** returns the country as an ISO2 code, not a name — the substring match on Places `formattedAddress` may miss ("Italy" vs "IT"). Seeded destinations return full names; the leak is only a risk on user-typed geocoded destinations. Fix: map ISO2 → full country name before passing to `countryFilter`.
- **Cleanup**: the standalone `/trips/[id]/map` route is now dead code (nothing links to it). Remove after confirming no external bookmarks depend on it.

### Nice-to-have

- Add a `TESTING.md` describing the vitest layout + how to add tests for a new provider.
- Push the plan-page MCQ card into a client component with optimistic reordering (currently server-round-trip per pick).
- The country filter matches on address substring — for a small set of edge cases (e.g. `Republic of Ireland` vs `Ireland`, `Czech Republic` vs `Czechia`) an alias map would harden it. Log a warning when a fetch returns >5 results all filtered out — that's the signal.

---

## Do not

- Do not `git add -A` or `git add .` — always list files explicitly.
- Do not create `.env.local` mirroring Secret Manager values — the loader defers to existing env, so a stale file pins an old value.
- Do not import `lib/secrets.ts` or `@google-cloud/secret-manager` from a client component or a file that a client component transitively imports.
- Do not skip pre-commit hooks (`--no-verify`) — investigate hook failures instead.
- Do not amend published commits or force-push `main`. Amend is fine within a feature branch before merge.
- Do not add `loading=async` back to the Maps JS SDK bootstrap. The synchronous loader in `map-view.tsx` is intentional — the async pattern's `importLibrary` race caused a "Map is not a constructor" crash that took three commits to unwind.
- Do not raise `radius > 50000` on any Places call. Both `searchNearby.locationRestriction` and `searchText.locationBias` hard-cap there; anything higher returns 400 INVALID_ARGUMENT.
