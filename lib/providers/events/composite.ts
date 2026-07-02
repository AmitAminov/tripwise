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

    // Only claim "live" when PredictHQ actually contributed real data.
    // If PHQ errored OR returned zero, this is curated-only.
    const phqContributed =
      phq.status === "live_checked" &&
      (phq.data?.length ?? 0) > 0;

    return {
      data: merged,
      status: phqContributed ? "live_checked" : "estimated",
      source: phqContributed ? "predicthq+curated" : "curated",
      checkedAt: now,
      // Surface the PredictHQ error even when curated saves the render,
      // so the UI can show a "Provider unavailable" chip per spec.
      error: phq.status === "error" ? phq.error : undefined,
    };
  },
};
