/**
 * Stale-while-revalidate cache with optional disk persistence.
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
 * Disk persistence: opt in by passing a `name`. Values are written to
 * `.tripwise-cache/<name>/<sha1-of-key>.json` fire-and-forget on set(),
 * and read lazily on peek() when the in-memory map misses — so a Next.js
 * process restart doesn't force every provider to re-fetch.
 *
 * The disk store is a best-effort side channel. It never blocks a caller,
 * never throws through the public API, and does nothing when `name` is
 * omitted (tests, ephemeral caches).
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

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
  /**
   * Optional name. When set, cache entries are also persisted to disk under
   * `.tripwise-cache/<name>/`. Restarts hydrate lazily on peek(). Omit
   * this for tests or ephemeral caches.
   */
  name?: string;
  /** Root directory for the on-disk cache. Defaults to `.tripwise-cache/`. */
  rootDir?: string;
}

interface Entry<T> {
  value: T;
  storedAt: number;
}

export interface SWRStatus {
  status: "fresh" | "stale" | "miss";
  ageMs?: number;
}

const DEFAULT_ROOT = path.join(process.cwd(), ".tripwise-cache");

function keyToFilename(key: string): string {
  return crypto.createHash("sha1").update(key).digest("hex") + ".json";
}

export class SWRCache<T> {
  private freshMs: number;
  private staleMs: number;
  private maxEntries: number;
  private onBackgroundError: (err: unknown, key: string) => void;
  private store = new Map<string, Entry<T>>();
  private inFlight = new Map<string, Promise<T>>();
  private diskDir: string | null;

  constructor(opts: SWRCacheOptions) {
    this.freshMs = opts.freshMs;
    this.staleMs = opts.staleMs ?? opts.freshMs * 4;
    this.maxEntries = opts.maxEntries ?? 500;
    this.onBackgroundError = opts.onBackgroundError ?? (() => undefined);
    if (opts.name) {
      const root = opts.rootDir ?? DEFAULT_ROOT;
      this.diskDir = path.join(root, opts.name);
      // Create the directory lazily on first write to avoid touching the
      // filesystem in constructor call chains that might be imported in
      // edge runtimes. Store the path here; ensure on write.
    } else {
      this.diskDir = null;
    }
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

  /**
   * Attempt to hydrate a single key from disk. Sync, small JSON — this is
   * called at most once per key per process. Returns null on any failure
   * so the caller falls through to the normal miss path.
   */
  private readFromDisk(key: string): Entry<T> | null {
    if (!this.diskDir) return null;
    try {
      const file = path.join(this.diskDir, keyToFilename(key));
      if (!fs.existsSync(file)) return null;
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as Entry<T>;
      if (
        !parsed ||
        typeof parsed.storedAt !== "number" ||
        parsed.value === undefined
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /** Fire-and-forget disk write. Never throws. */
  private writeToDisk(key: string, entry: Entry<T>): void {
    if (!this.diskDir) return;
    const dir = this.diskDir;
    (async () => {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        const file = path.join(dir, keyToFilename(key));
        const tmp = file + ".tmp";
        await fs.promises.writeFile(tmp, JSON.stringify(entry), "utf8");
        await fs.promises.rename(tmp, file);
      } catch (err) {
        this.onBackgroundError(err, `disk-write:${key}`);
      }
    })();
  }

  peek(key: string): { value: T; status: SWRStatus } | null {
    let entry = this.store.get(key);
    if (!entry) {
      // Try to hydrate from disk before treating this as a real miss.
      const fromDisk = this.readFromDisk(key);
      if (fromDisk) {
        this.store.set(key, fromDisk);
        this.evictIfFull();
        entry = fromDisk;
      }
    }
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
    this.writeToDisk(key, entry);
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
