import { describe, it, expect } from "vitest";
import {
  deepLinkHotelProvider,
  buildBookingUrl,
  buildAirbnbUrl,
  buildHostelworldUrl,
} from "@/lib/providers/hotels/deep-links";

describe("hotel deep-link estimator", () => {
  it("scales estimate with comfort level (luxury > standard > budget)", async () => {
    const shared = { destination: "Prague", nights: 7, guests: 2 } as const;
    const budget = await deepLinkHotelProvider.estimate({
      ...shared,
      comfortLevel: "budget",
    });
    const standard = await deepLinkHotelProvider.estimate({
      ...shared,
      comfortLevel: "standard",
    });
    const luxury = await deepLinkHotelProvider.estimate({
      ...shared,
      comfortLevel: "luxury",
    });
    expect(luxury.data!.perNight.expected).toBeGreaterThan(
      standard.data!.perNight.expected,
    );
    expect(standard.data!.perNight.expected).toBeGreaterThan(
      budget.data!.perNight.expected,
    );
  });

  it("surfaces per-destination area recommendations", async () => {
    const result = await deepLinkHotelProvider.estimate({
      destination: "Prague",
      nights: 7,
      comfortLevel: "standard",
      guests: 2,
    });
    const areas = result.data!.areas ?? [];
    expect(areas.length).toBeGreaterThanOrEqual(1);
    expect(areas.map((a) => a.name)).toContain("Old Town (Staré Město)");
  });

  it("falls back to generic estimate for unseeded destinations", async () => {
    const result = await deepLinkHotelProvider.estimate({
      destination: "Reykjavik",
      nights: 4,
      comfortLevel: "standard",
      guests: 2,
    });
    expect(result.data).not.toBeNull();
    expect(result.data!.perNight.expected).toBeGreaterThan(0);
    expect(result.data!.areas).toEqual([]);
  });
});

describe("deep link URL builders", () => {
  it("Booking.com URL includes destination + dates + guests", () => {
    const url = buildBookingUrl(
      "Prague, Czech Republic",
      "2026-09-20",
      "2026-09-27",
      2,
    );
    expect(url).toContain("booking.com");
    expect(url).toContain("Prague");
    expect(url).toContain("checkin=2026-09-20");
    expect(url).toContain("checkout=2026-09-27");
    expect(url).toContain("group_adults=2");
  });

  it("Airbnb URL encodes destination", () => {
    const url = buildAirbnbUrl(
      "South Italy",
      "2026-09-15",
      "2026-09-22",
      3,
    );
    expect(url).toContain("airbnb.com");
    expect(url).toContain("South%20Italy");
    expect(url).toContain("adults=3");
  });

  it("Hostelworld URL includes destination search", () => {
    const url = buildHostelworldUrl("Bangkok");
    expect(url).toContain("hostelworld.com");
    expect(url).toContain("Bangkok");
  });

  it("URL builders survive null dates", () => {
    const url = buildBookingUrl("Naples", null, null, 2);
    expect(url).not.toContain("checkin=");
    expect(url).not.toContain("checkout=");
    expect(url).toContain("ss=Naples");
  });
});
