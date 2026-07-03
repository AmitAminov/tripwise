import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enqueueDeepResearch, getJob } from "@/lib/deep-research/queue";
import { defaultTripIntent } from "@/lib/types/trip-intent";
import { intentHash } from "@/lib/scoring";

function encode(intent: unknown): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

describe("Deep Research background queue", () => {
  // The fire-and-forget job fetches weather (Open-Meteo needs no key), so
  // stub fetch to keep the suite offline-safe and deterministic in CI.
  // The queue swallows per-destination fetch failures by design.
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("network disabled in unit tests");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("enqueues + returns a queued job immediately", () => {
    const intent = defaultTripIntent("deep_research");
    intent.candidateDestinations = ["prague"];
    const job = enqueueDeepResearch(encode(intent));
    expect(job.status === "queued" || job.status === "running").toBe(true);
    expect(job.id.length).toBeGreaterThan(0);
    expect(getJob(job.id)).toBeDefined();
  });

  it("marks the job as failed on malformed intent", async () => {
    const job = enqueueDeepResearch("this-is-not-base64url-json!");
    // Allow the microtask fire-and-forget to progress.
    await new Promise((r) => setTimeout(r, 20));
    const fetched = getJob(job.id);
    expect(fetched?.status).toBe("failed");
    expect(fetched?.error?.toLowerCase()).toContain("intent");
  });

  it("returns undefined for an unknown job id", () => {
    expect(getJob("no-such-job")).toBeUndefined();
  });

  it("stamps the result with the intent hash, not the job id", async () => {
    const intent = defaultTripIntent("deep_research");
    intent.candidateDestinations = ["prague"];
    const job = enqueueDeepResearch(encode(intent));
    // Poll for the fire-and-forget job to finish (provider fetches all
    // fail fast against the stubbed fetch and are swallowed by design).
    const deadline = Date.now() + 2_000;
    while (getJob(job.id)?.status !== "done" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const fetched = getJob(job.id);
    expect(fetched?.status).toBe("done");
    expect(fetched?.result?.intentHash).toBe(intentHash(intent));
    expect(fetched?.result?.intentHash).not.toBe(job.id);
  });
});
