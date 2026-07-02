import { describe, it, expect } from "vitest";
import { enqueueDeepResearch, getJob } from "@/lib/deep-research/queue";
import { defaultTripIntent } from "@/lib/types/trip-intent";

function encode(intent: unknown): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

describe("Deep Research background queue", () => {
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
});
