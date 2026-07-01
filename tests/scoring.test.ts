import { describe, it, expect } from "vitest";
import {
  scoreDestination,
  rankDestinations,
  decodeIntent,
} from "@/lib/scoring";
import { DESTINATIONS } from "@/data/destinations";
import { defaultTripIntent } from "@/lib/types/trip-intent";

describe("destination scoring", () => {
  it("returns higher score for a destination whose interests align", () => {
    const intent = defaultTripIntent("plan_now");
    intent.preferences.interests = ["food", "culture", "architecture"];
    intent.budget.perPerson = 2000;

    const prague = DESTINATIONS.find((d) => d.id === "prague")!;
    const bangkok = DESTINATIONS.find((d) => d.id === "bangkok")!;

    const praguerScore = scoreDestination(prague, intent);
    const bangkokScore = scoreDestination(bangkok, intent);

    // Prague signals food, culture, architecture directly — should beat
    // Bangkok on preference match at these interests.
    expect(praguerScore.breakdown.preferenceMatch).toBeGreaterThanOrEqual(
      bangkokScore.breakdown.preferenceMatch,
    );
  });

  it("penalizes destinations that blow the budget", () => {
    const cheap = defaultTripIntent("plan_now");
    cheap.budget.perPerson = 300; // absurdly low
    cheap.travelers.adults = 2;

    const bangkok = DESTINATIONS.find((d) => d.id === "bangkok")!;
    const scored = scoreDestination(bangkok, cheap);

    expect(scored.breakdown.budgetFit).toBeLessThan(0);
    expect(scored.concerns.some((c) => c.includes("budget"))).toBe(true);
  });

  it("rewards direct-flight destinations", () => {
    const intent = defaultTripIntent("plan_now");
    intent.constraints.directFlightsOnly = true;

    const prague = DESTINATIONS.find((d) => d.id === "prague")!;
    const bangkok = DESTINATIONS.find((d) => d.id === "bangkok")!;

    const p = scoreDestination(prague, intent);
    const b = scoreDestination(bangkok, intent);

    expect(p.breakdown.flightConvenience).toBeGreaterThan(
      b.breakdown.flightConvenience,
    );
  });

  it("subtracts travel_fatigue for long flights", () => {
    const intent = defaultTripIntent("plan_now");
    const bangkok = DESTINATIONS.find((d) => d.id === "bangkok")!;
    const scored = scoreDestination(bangkok, intent);
    // Bangkok is ~12h from TLV — bucket should be < -1
    expect(scored.breakdown.travelFatigue).toBeLessThan(0);
  });

  it("does not treat visa_free as friction", () => {
    const intent = defaultTripIntent("plan_now");
    const prague = DESTINATIONS.find((d) => d.id === "prague")!;
    expect(scoreDestination(prague, intent).breakdown.visaFriction).toBe(0);
  });

  it("total = sum of components (invariant)", () => {
    const intent = defaultTripIntent("plan_now");
    const prague = DESTINATIONS.find((d) => d.id === "prague")!;
    const s = scoreDestination(prague, intent);
    const { total, ...components } = s.breakdown;
    const sum = Object.values(components).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(sum, 5);
  });

  it("rankDestinations returns descending scores", () => {
    const intent = defaultTripIntent("plan_now");
    intent.preferences.interests = ["food", "beaches"];
    const ranked = rankDestinations(DESTINATIONS, intent);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});

describe("intent encoding", () => {
  it("decodes null cleanly", () => {
    expect(decodeIntent(null)).toBeNull();
    expect(decodeIntent("")).toBeNull();
  });

  it("decodes garbage as null", () => {
    expect(decodeIntent("not-base64!")).toBeNull();
    expect(decodeIntent("aGVsbG8=")).toBeNull(); // valid base64, not JSON
  });

  it("round-trips a real intent through base64url", () => {
    const original = defaultTripIntent("plan_now");
    original.preferences.interests = ["food", "culture"];
    original.candidateDestinations = ["prague", "bangkok"];
    const encoded = Buffer.from(JSON.stringify(original)).toString("base64url");
    const decoded = decodeIntent(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.preferences.interests).toEqual(["food", "culture"]);
    expect(decoded!.candidateDestinations).toEqual(["prague", "bangkok"]);
  });
});
