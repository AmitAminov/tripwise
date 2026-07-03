import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, vi } from "vitest";
import { SWRCache } from "@/lib/swr-cache";

/** Poll until `cond` holds — disk writes/deletes are fire-and-forget. */
async function waitFor(cond: () => boolean, timeoutMs = 2_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Completed (renamed, non-.tmp) entry files in a cache directory. */
function entryFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => !f.endsWith(".tmp"));
}

describe("SWRCache", () => {
  it("returns fresh on immediate re-read", async () => {
    const cache = new SWRCache<number>({ freshMs: 1_000 });
    const fetcher = vi.fn(async () => 42);
    const first = await cache.get("k", fetcher);
    const second = await cache.get("k", fetcher);
    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    expect(first.status.status).toBe("miss");
    expect(second.status.status).toBe("fresh");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns stale and revalidates in background between freshMs and staleMs", async () => {
    vi.useFakeTimers();
    const cache = new SWRCache<number>({ freshMs: 100, staleMs: 500 });
    let calls = 0;
    const fetcher = async () => ++calls;

    await cache.get("k", fetcher); // miss → 1
    vi.setSystemTime(new Date(Date.now() + 200)); // > freshMs, < staleMs

    const second = await cache.get("k", fetcher);
    expect(second.status.status).toBe("stale");
    expect(second.value).toBe(1); // stale value returned immediately

    // Give the background revalidation a tick.
    await vi.runAllTimersAsync();
    // Later reads see the refreshed value.
    vi.setSystemTime(new Date(Date.now() + 10)); // still inside new freshness
    const third = await cache.get("k", fetcher);
    expect(third.value).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("re-fetches when past staleMs (hard miss)", async () => {
    vi.useFakeTimers();
    const cache = new SWRCache<number>({ freshMs: 100, staleMs: 200 });
    const fetcher = vi.fn(async () => Math.random());
    await cache.get("k", fetcher);
    vi.setSystemTime(new Date(Date.now() + 500)); // > staleMs
    const result = await cache.get("k", fetcher);
    expect(result.status.status).toBe("miss");
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("coalesces concurrent misses into one fetch", async () => {
    const cache = new SWRCache<number>({ freshMs: 1_000 });
    const fetcher = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 7;
    });
    const [a, b, c] = await Promise.all([
      cache.get("k", fetcher),
      cache.get("k", fetcher),
      cache.get("k", fetcher),
    ]);
    expect(a.value).toBe(7);
    expect(b.value).toBe(7);
    expect(c.value).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("evicts LRU entries when over capacity", async () => {
    const cache = new SWRCache<number>({
      freshMs: 60_000,
      maxEntries: 3,
    });
    await cache.get("a", async () => 1);
    await cache.get("b", async () => 2);
    await cache.get("c", async () => 3);
    await cache.get("d", async () => 4); // should evict "a"
    expect(cache.peek("a")).toBeNull();
    expect(cache.peek("d")).not.toBeNull();
    expect(cache.size()).toBe(3);
  });

  it("records a failed background revalidation instead of rejecting", async () => {
    vi.useFakeTimers();
    const onBackgroundError = vi.fn();
    const cache = new SWRCache<number>({
      freshMs: 100,
      staleMs: 500,
      onBackgroundError,
    });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      if (calls > 1) throw new Error("upstream down");
      return 1;
    };

    await cache.get("k", fetcher); // miss → 1
    vi.setSystemTime(new Date(Date.now() + 200)); // stale window

    const stale = await cache.get("k", fetcher); // kicks off failing revalidation
    expect(stale.status.status).toBe("stale");
    expect(stale.value).toBe(1);

    // Flush the background promise. Before the fix this rethrew inside a
    // never-awaited promise → unhandled rejection.
    await vi.runAllTimersAsync();
    expect(onBackgroundError).toHaveBeenCalledTimes(1);

    // The stale value keeps being served after the failed refresh.
    const again = await cache.get("k", fetcher);
    expect(again.value).toBe(1);
    vi.useRealTimers();
  });
});

describe("SWRCache disk persistence", () => {
  it("persists on set() and removes the disk entry on delete()", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "swr-cache-test-"));
    try {
      const cache = new SWRCache<number>({
        freshMs: 60_000,
        name: "t",
        rootDir: root,
      });
      cache.set("k", 42);
      const dir = path.join(root, "t");
      await waitFor(() => entryFiles(dir).length === 1);

      cache.delete("k");
      await waitFor(() => entryFiles(dir).length === 0);
      expect(cache.peek("k")).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("hydrates lazily from disk in a fresh instance (restart survival)", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "swr-cache-test-"));
    try {
      const first = new SWRCache<number>({
        freshMs: 60_000,
        name: "t",
        rootDir: root,
      });
      first.set("k", 7);
      const dir = path.join(root, "t");
      await waitFor(() => entryFiles(dir).length === 1);

      const second = new SWRCache<number>({
        freshMs: 60_000,
        name: "t",
        rootDir: root,
      });
      const hit = second.peek("k");
      expect(hit?.value).toBe(7);
      expect(hit?.status.status).toBe("fresh");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
