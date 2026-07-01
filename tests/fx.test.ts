import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toUSD, toUSDMany } from "@/lib/fx";

describe("FX conversion", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Return the FALLBACK_RATES-shaped payload so tests are deterministic
    // without hitting the real network.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            result: "success",
            base_code: "USD",
            rates: {
              USD: 1,
              ILS: 3.6,
              EUR: 0.92,
              GBP: 0.78,
              THB: 35.5,
              CZK: 22.5,
            },
          }),
          { status: 200 },
        ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    // Purge in-memory cache between tests by importing a fresh module.
    vi.resetModules();
  });

  it("USD passes through unchanged", async () => {
    expect(await toUSD(1000, "USD")).toBe(1000);
    expect(await toUSD(0, "USD")).toBe(0);
  });

  it("converts ILS to USD using the rate", async () => {
    const usd = await toUSD(3600, "ILS");
    expect(usd).toBeCloseTo(1000, 1);
  });

  it("leaves unknown currency untouched (no crash)", async () => {
    // Not a real currency code — should return the amount as-is.
    expect(await toUSD(100, "ZZZ")).toBe(100);
  });

  it("normalizes zero amount to zero regardless of currency", async () => {
    expect(await toUSD(0, "ILS")).toBe(0);
    expect(await toUSD(0, "EUR")).toBe(0);
  });

  it("batches conversions in a single FX lookup", async () => {
    // Reset cache so this test triggers the fetch
    vi.resetModules();
    const { toUSDMany: fresh } = await import("@/lib/fx");
    const results = await fresh([
      { amount: 3600, currency: "ILS" },
      { amount: 92, currency: "EUR" },
      { amount: 100, currency: "USD" },
    ]);
    expect(results[0]).toBeCloseTo(1000, 1);
    expect(results[1]).toBeCloseTo(100, 1);
    expect(results[2]).toBe(100);
    // Should have used at most one HTTP call for the batch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("FX fallback (endpoint unreachable)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("network down");
    });
  });

  it("uses conservative fallback rates when the API is unreachable", async () => {
    const { toUSD: fresh } = await import("@/lib/fx");
    const result = await fresh(3600, "ILS");
    // Fallback ILS rate is 3.6
    expect(result).toBeCloseTo(1000, 1);
  });
});
