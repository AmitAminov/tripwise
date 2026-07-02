/**
 * In-memory stale-while-revalidate cache. One instance per module or per
 * logical provider (call `new SWRCache<T>({ ... })`).
 *
 * Behavior:
 *  - Cache hit inside `freshMs`: return cached, no work.
 *  - Cache hit between `freshMs` and `staleMs`: return cached, kick off a
 *    background revalidation. Callers get a fast response while the newer
 *    result populates for the next reader.
 *  - Cache miss or past `staleMs`: block the caller, fetch, populate.
 *  - Concurrent misses coalesce onto a single in-flight promise so we
 *    never fan out N identical upstream requests.
 *
 * Intentionally per-process (Next.js server). Redis is the future upgrade
 * hinted at in the spec — this preserves the same public surface.
 */

export interface SWRCacheOptions {
  /** Max ms before a value is considered stale (still usable, will revalidate). */
  freshMs: number;
  /**
   * Max ms before a value is considered dead (caller has to wait for fresh).
   * Defaults to freshMs * 4.
   */
  staleMs?: number;
  /** Max entries retained. LRU-ish eviction. Default 500. */
  maxEntries?: number;
  /**
   * Called when a background revalidation throws. Silent by default.
   */
  onBackgroundError?: (err: unknown, key: string) => void;
}

interface Entry<T> {
  value: T;
  storedAt: number;
}

export interface SWRStatus {
  status: "fresh" | "stale" | "miss";
  ageMs?: number;
}

export class SWRCache<T> {
  private freshMs: number;
  private staleMs: number;
  private maxEntries: number;
  private onBackgroundError: (err: unknown, key: string) => void;
  private store = new Map<string, Entry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(opts: SWRCacheOptions) {
    this.freshMs = opts.freshMs;
    this.staleMs = opts.staleMs ?? opts.freshMs * 4;
    this.maxEntries = opts.maxEntries ?? 500;
    this.onBackgroundError = opts.onBackgroundError ?? (() => undefined);
  }

  private touch(key: string, entry: Entry<T>) {
    // Move-to-front for LRU behavior on Map iteration.
    this.store.delete(key);
    this.store.set(key, entry);
  }

  private evictIfFull() {
    if (this.store.size <= this.maxEntries) return;
    const first = this.store.keys().next();
    if (!first.done) this.store.delete(first.value);
  }

  peek(key: string): { value: T; status: SWRStatus } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.storedAt;
    if (age <= this.freshMs)
      return { value: entry.value, status: { status: "fresh", ageMs: age } };
    if (age <= this.staleMs)
      return { value: entry.value, status: { status: "stale", ageMs: age } };
    return null;
  }

  /**
   * Public read-through with SWR.
   *   const result = await cache.get(key, fetcher);
   *   result.status is "fresh" | "stale" | "miss"; result.value is the T.
   */
  async get(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<{ value: T; status: SWRStatus }> {
    const hit = this.peek(key);
    if (hit && hit.status.status === "fresh") return hit;

    if (hit && hit.status.status === "stale") {
      // Kick off background revalidation if none in flight yet.
      if (!this.inFlight.has(key)) {
        const promise = fetcher()
          .then((next) => {
            this.set(key, next);
            return next;
          })
          .catch((err) => {
            this.onBackgroundError(err, key);
            // Re-throw so any concurrent awaiter sees the error.
            throw err;
          })
          .finally(() => {
            this.inFlight.delete(key);
          });
        this.inFlight.set(key, promise);
      }
      return hit;
    }

    // Miss or past staleMs → block on the fetch, coalescing concurrent
    // callers onto the same in-flight promise.
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = fetcher()
        .then((next) => {
          this.set(key, next);
          return next;
        })
        .finally(() => {
          this.inFlight.delete(key);
        });
      this.inFlight.set(key, pending);
    }
    const value = await pending;
    return { value, status: { status: "miss" } };
  }

  set(key: string, value: T) {
    const entry: Entry<T> = { value, storedAt: Date.now() };
    if (this.store.has(key)) this.touch(key, entry);
    else {
      this.store.set(key, entry);
      this.evictIfFull();
    }
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.store.size;
  }
}
