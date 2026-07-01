import { describe, it, expect } from "vitest";
import { curatedEventsProvider } from "@/lib/providers/events/curated";

describe("curated events provider", () => {
  it("returns Prague events for a Prague trip in October", async () => {
    const result = await curatedEventsProvider.search({
      city: "Prague",
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-31T23:59:59Z",
    });
    expect(result.status).toBe("estimated");
    expect(result.data).not.toBeNull();
    expect(result.data!.length).toBeGreaterThan(0);
    // Signal Festival lives in mid-October
    expect(
      result.data!.some((e) =>
        e.name.toLowerCase().includes("signal"),
      ),
    ).toBe(true);
  });

  it("matches South Italy through Amalfi / Naples aliases", async () => {
    const result = await curatedEventsProvider.search({
      city: "Amalfi coast",
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-30T23:59:59Z",
    });
    expect(result.data).not.toBeNull();
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it("returns zero events when the window doesn't overlap", async () => {
    const result = await curatedEventsProvider.search({
      city: "Prague",
      from: "2027-03-01T00:00:00Z",
      to: "2027-03-31T23:59:59Z",
    });
    expect(result.data).toEqual([]);
  });

  it("filters by category", async () => {
    const result = await curatedEventsProvider.search({
      city: "Bangkok",
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-30T23:59:59Z",
      categories: ["culture"],
    });
    expect(result.data).not.toBeNull();
    for (const e of result.data!) {
      const hit = e.categories.some((c) =>
        ["culture"].includes(c.toLowerCase()),
      );
      expect(hit).toBe(true);
    }
  });

  it("returns no events for an unknown city", async () => {
    const result = await curatedEventsProvider.search({
      city: "Reykjavik",
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-30T23:59:59Z",
    });
    expect(result.data).toEqual([]);
  });

  it("marks every returned event as source=curated", async () => {
    const result = await curatedEventsProvider.search({
      city: "Prague",
      from: "2026-10-15T00:00:00Z",
      to: "2026-10-20T23:59:59Z",
    });
    for (const e of result.data!) {
      expect(e.source).toBe("curated");
    }
  });
});
