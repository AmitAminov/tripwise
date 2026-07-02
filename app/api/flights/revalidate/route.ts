/**
 * POST /api/flights/revalidate
 * body: { origin, destination, departDate, returnDate?, adults, bookingUrl? }
 *
 * Spec: "Never show cached live prices as confirmed unless revalidated."
 * When the user clicks a book-through link on a saved flight offer,
 * this endpoint re-hits the provider RIGHT NOW to promote the price
 * from `live_checked` → `confirmed`. If the price shifted materially
 * the client can present the delta before opening the booking link.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flightProvider } from "@/lib/providers";
import type { PriceEstimate } from "@/lib/types/trip-intent";

interface Body {
  origin?: unknown;
  destination?: unknown;
  departDate?: unknown;
  returnDate?: unknown;
  adults?: unknown;
  bookingUrl?: unknown;
}

const PRICE_SHIFT_TOLERANCE = 0.05; // 5%

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const origin =
    typeof body.origin === "string" ? body.origin.toUpperCase() : "";
  const destination =
    typeof body.destination === "string"
      ? body.destination.toUpperCase()
      : "";
  const departDate =
    typeof body.departDate === "string" ? body.departDate : "";
  const returnDate =
    typeof body.returnDate === "string" ? body.returnDate : undefined;
  const adults = Math.max(1, Math.min(10, Number(body.adults ?? 1)));
  const bookingUrl =
    typeof body.bookingUrl === "string" ? body.bookingUrl : undefined;

  if (origin.length !== 3 || destination.length !== 3 || !departDate) {
    return NextResponse.json(
      { error: "origin, destination, departDate required" },
      { status: 400 },
    );
  }

  // Any authed user can revalidate — no trip-scoping needed since we
  // only echo public flight data.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const provider = flightProvider();
  const result = await provider.search({
    originAirport: origin,
    destinationAirport: destination,
    departDate,
    returnDate,
    adults,
    cabinClass: "economy",
  });

  if (result.status === "error" || !result.data || result.data.length === 0) {
    return NextResponse.json(
      { error: result.error ?? "No offers now." },
      { status: 502 },
    );
  }

  const cheapest = result.data[0];
  const confirmed: PriceEstimate = {
    component: `Flights ${origin} → ${destination}`,
    min: cheapest.totalPriceUSD,
    expected: cheapest.totalPriceUSD,
    max: cheapest.totalPriceUSD,
    currency: cheapest.currency,
    confidence: "high",
    // Promoted from live_checked → confirmed per spec's provenance ladder.
    // The client should open the bookingUrl within a few minutes; the
    // "confirmed" claim decays past that point and should re-run.
    status: "confirmed",
    source: "fast-flights",
    checkedAt: cheapest.checkedAt,
    bookingUrl,
  };

  return NextResponse.json({
    confirmed,
    revalidatedAt: new Date().toISOString(),
    priceShiftTolerance: PRICE_SHIFT_TOLERANCE,
  });
}
