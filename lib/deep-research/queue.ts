/**
 * In-memory Deep Research job queue.
 *
 * Spec: "Full Deep Research mode must not block the request/response
 * cycle. It should start a background job and stream or poll progress."
 *
 * This ships without Redis. When you outgrow single-process (Vercel
 * would already prevent this on serverless), swap for BullMQ / Cloudflare
 * Queues by making Queue conform to a common interface.
 */

import { decodeIntent, rankDestinations } from "@/lib/scoring";
import { DESTINATIONS } from "@/data/destinations";
import { weatherProvider, eventsProvider } from "@/lib/providers";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number; // 0..1
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  message: string;
  result?: DeepResearchResult;
  error?: string;
}

export interface DeepResearchResult {
  intentHash: string;
  ranked: Array<{
    destinationId: string;
    name: string;
    score: number;
    reasons: string[];
    concerns: string[];
    weatherSummary?: string;
    eventCount?: number;
  }>;
  runDurationMs: number;
}

const jobs = new Map<string, Job>();

function nextId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Enqueue a Deep Research pass over the encoded TripIntent.
 * Returns the job id immediately; the actual work runs off the
 * request cycle via a fire-and-forget async function.
 */
export function enqueueDeepResearch(intentEncoded: string): Job {
  const id = nextId();
  const job: Job = {
    id,
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
    message: "Queued",
  };
  jobs.set(id, job);
  void runJob(id, intentEncoded);
  return job;
}

async function runJob(id: string, intentEncoded: string) {
  const job = jobs.get(id);
  if (!job) return;

  job.status = "running";
  job.startedAt = Date.now();
  job.message = "Starting deep research";
  job.progress = 0.05;

  const intent = decodeIntent(intentEncoded);
  if (!intent) {
    job.status = "failed";
    job.error = "Malformed intent";
    job.finishedAt = Date.now();
    return;
  }

  const candidateIds = intent.candidateDestinations ?? [];
  const candidates =
    candidateIds.length > 0
      ? DESTINATIONS.filter((d) => candidateIds.includes(d.id))
      : DESTINATIONS;

  try {
    // Stage 1 — ranking (fast)
    job.message = "Ranking candidates";
    const ranked = rankDestinations(candidates, intent);
    job.progress = 0.2;

    // Stage 2 — weather per destination
    job.message = "Fetching weather forecasts";
    const weather = weatherProvider();
    const from = intent.startDate ?? "2026-09-20";
    const to = intent.endDate ?? "2026-09-27";
    const weatherResults = await Promise.all(
      ranked.map((r) =>
        weather
          .forecast(
            r.destination.coords.lat,
            r.destination.coords.lng,
            from,
            to,
          )
          .catch(() => null),
      ),
    );
    job.progress = 0.6;

    // Stage 3 — events per destination
    job.message = "Discovering events";
    const events = eventsProvider();
    const eventCounts = await Promise.all(
      ranked.map((r) =>
        events
          .search({
            city: r.destination.name,
            from: from + "T00:00:00Z",
            to: to + "T23:59:59Z",
            limit: 20,
          })
          .then((res) => res.data?.length ?? 0)
          .catch(() => 0),
      ),
    );
    job.progress = 0.9;

    // Stage 4 — assemble the report
    const result: DeepResearchResult = {
      intentHash: id,
      ranked: ranked.map((r, i) => ({
        destinationId: r.destination.id,
        name: r.destination.name,
        score: r.score,
        reasons: r.reasons,
        concerns: r.concerns,
        weatherSummary: weatherResults[i]?.data?.summary,
        eventCount: eventCounts[i],
      })),
      runDurationMs: Date.now() - (job.startedAt ?? Date.now()),
    };

    job.result = result;
    job.status = "done";
    job.progress = 1;
    job.message = "Done";
    job.finishedAt = Date.now();
  } catch (e) {
    job.status = "failed";
    job.error = e instanceof Error ? e.message : String(e);
    job.finishedAt = Date.now();
  }
}
