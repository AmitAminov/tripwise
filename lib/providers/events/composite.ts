/**
 * Composite events provider — merges Ticketmaster + PredictHQ + curated
 * seed. All three run in parallel; the seed always fires as a cheap
 * fallback so we still show something if both live sources fail.
 */

import type {
  EventItem,
  EventSearchQuery,
  EventsProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { curatedEventsProvider } from "./curated";
import { predictHqEventsProvider } from "./predicthq";
import { ticketmasterEventsProvider } from "./ticketmaster";

function dedupe(events: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  const out: EventItem[] = [];
  for (const e of events) {
    const key = `${e.name.trim().toLowerCase()}|${e.startAt.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export const compositeEventsProvider: EventsProvider = {
  name: "composite",
  async search(q: EventSearchQuery): Promise<ProviderResult<EventItem[]>> {
    const now = new Date().toISOString();
    const runTicketmaster = Boolean(process.env.TICKETMASTER_API_KEY);
    const [tm, phq, curated] = await Promise.all([
      runTicketmaster
        ? ticketmasterEventsProvider.search(q)
        : Promise.resolve({
            data: [],
            status: "unavailable" as const,
            source: "ticketmaster",
            checkedAt: now,
          }),
      predictHqEventsProvider.search(q),
      curatedEventsProvider.search(q),
    ]);

    // Ticketmaster first (ticket-selling events with URLs), then
    // PredictHQ (ranked festivals + community), then curated seed
    // (evergreen recurring hits).
    const merged = dedupe([
      ...(tm.data ?? []),
      ...(phq.data ?? []),
      ...(curated.data ?? []),
    ]);

    // Live badge fires only when a live source actually returned rows.
    const tmContributed =
      tm.status === "live_checked" && (tm.data?.length ?? 0) > 0;
    const phqContributed =
      phq.status === "live_checked" && (phq.data?.length ?? 0) > 0;
    const anyLive = tmContributed || phqContributed;

    const sources: string[] = [];
    if (tmContributed) sources.push("ticketmaster");
    if (phqContributed) sources.push("predicthq");
    sources.push("curated");

    const errors: string[] = [];
    if (tm.status === "error" && tm.error) errors.push(`tm: ${tm.error}`);
    if (phq.status === "error" && phq.error)
      errors.push(`phq: ${phq.error}`);

    return {
      data: merged,
      status: anyLive ? "live_checked" : "estimated",
      source: sources.join("+"),
      checkedAt: now,
      error: errors.length > 0 ? errors.join(" · ") : undefined,
    };
  },
};
