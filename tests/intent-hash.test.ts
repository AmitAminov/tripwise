import { describe, it, expect } from "vitest";
import { intentHash } from "@/lib/scoring";
import { defaultTripIntent } from "@/lib/types/trip-intent";

describe("intent hash (TripIntent-hash cache key)", () => {
  it("is stable for the same material fields", () => {
    const a = defaultTripIntent("plan_now");
    const b = defaultTripIntent("plan_now");
    expect(intentHash(a)).toBe(intentHash(b));
  });

  it("changes when interests differ", () => {
    const a = defaultTripIntent("plan_now");
    const b = defaultTripIntent("plan_now");
    a.preferences.interests = ["food"];
    b.preferences.interests = ["beaches"];
    expect(intentHash(a)).not.toBe(intentHash(b));
  });

  it("is order-insensitive for interests", () => {
    const a = defaultTripIntent("plan_now");
    const b = defaultTripIntent("plan_now");
    a.preferences.interests = ["food", "culture"];
    b.preferences.interests = ["culture", "food"];
    expect(intentHash(a)).toBe(intentHash(b));
  });

  it("changes when budget changes", () => {
    const a = defaultTripIntent("plan_now");
    const b = defaultTripIntent("plan_now");
    a.budget.perPerson = 1500;
    b.budget.perPerson = 3000;
    expect(intentHash(a)).not.toBe(intentHash(b));
  });

  it("returns a short base36 string", () => {
    const h = intentHash(defaultTripIntent("plan_now"));
    expect(h).toMatch(/^[a-z0-9]+$/);
    expect(h.length).toBeLessThan(20);
  });
});
