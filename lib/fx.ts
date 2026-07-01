/**
 * Foreign-exchange conversion — normalizes provider prices (ILS, EUR, GBP,
 * whatever Google Flights returns for the requester's locale) to USD for
 * cross-destination comparison.
 *
 * Free public source (no key): https://open.er-api.com/v6/latest/USD
 * Cached in-memory for 24h so we don't hammer it. Falls back to a
 * hardcoded conservative rate table if the endpoint is unreachable so
 * the UI never breaks on network flakes.
 */

interface FXRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let cache: FXRates | null = null;
let inFlight: Promise<FXRates> | null = null;

// Rough conservative rates as of mid-2026 — used only when the FX
// endpoint is unreachable. Better a stale-but-usable price than
// nothing. Values are units-of-CURRENCY per 1 USD.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  ILS: 3.6,
  EUR: 0.92,
  GBP: 0.78,
  CZK: 22.5,
  THB: 35.5,
  JPY: 155,
  CAD: 1.36,
  AUD: 1.5,
};

async function fetchRates(): Promise<FXRates> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(3_000),
      // 24h Next cache alongside our in-memory one
      next: { revalidate: 24 * 60 * 60 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      result?: string;
      base_code?: string;
      rates?: Record<string, number>;
    };
    if (body.result !== "success" || !body.rates) {
      throw new Error("bad response shape");
    }
    return {
      base: body.base_code ?? "USD",
      rates: body.rates,
      fetchedAt: Date.now(),
    };
  } catch {
    return {
      base: "USD",
      rates: FALLBACK_RATES,
      fetchedAt: Date.now(),
    };
  }
}

async function getRates(): Promise<FXRates> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = fetchRates().then((r) => {
    cache = r;
    inFlight = null;
    return r;
  });
  return inFlight;
}

export async function toUSD(
  amount: number,
  currency: string,
): Promise<number> {
  const from = currency.toUpperCase();
  if (from === "USD" || amount === 0) return amount;
  const rates = await getRates();
  const rate = rates.rates[from];
  if (!rate || rate <= 0) return amount; // unknown — leave as-is
  return amount / rate;
}

export async function toUSDMany(
  items: Array<{ amount: number; currency: string }>,
): Promise<number[]> {
  if (items.length === 0) return [];
  const rates = await getRates();
  return items.map(({ amount, currency }) => {
    const from = currency.toUpperCase();
    if (from === "USD" || amount === 0) return amount;
    const rate = rates.rates[from];
    if (!rate || rate <= 0) return amount;
    return amount / rate;
  });
}
