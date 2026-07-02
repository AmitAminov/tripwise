import { describe, it, expect, vi } from "vitest";
import { SWRCache } from "@/lib/swr-cache";

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
});
