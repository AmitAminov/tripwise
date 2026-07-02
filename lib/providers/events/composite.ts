/**
 * Composite events provider — merges PredictHQ (live) with the curated
 * seed. Both sources run in parallel; the seed always fires as a
 * cheap fallback so we still show something if PredictHQ has an
 * outage.
 */

import type {
  EventItem,
  EventSearchQuery,
  EventsProvider,
  ProviderResult,
} from "@/lib/providers/types";
import { curatedEventsProvider } from "./curated";
import { predictHqEventsProvider } from "./predicthq";

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
    const [phq, curated] = await Promise.all([
      predictHqEventsProvider.search(q),
      curatedEventsProvider.search(q),
    ]);

    // Prefer PredictHQ ordering (higher local_rank first). Append the
    // curated seed after so users always see the recurring hits.
    const merged = dedupe([
      ...(phq.data ?? []),
      ...(curated.data ?? []),
    ]);

    const anyLive = phq.status === "live_checked";
    return {
      data: merged,
      status: anyLive
        ? "live_checked"
        : phq.status === "error" && curated.data && curated.data.length > 0
          ? "estimated"
          : "estimated",
      source: anyLive ? "predicthq+curated" : "curated",
      checkedAt: now,
      error: !anyLive ? phq.error : undefined,
    };
  },
};
