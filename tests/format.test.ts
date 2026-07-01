import { describe, it, expect } from "vitest";
import {
  formatUSD,
  formatCurrency,
  formatDateRange,
  formatDurationHours,
} from "@/lib/format";

describe("format helpers", () => {
  it("formatUSD renders whole-dollar amounts", () => {
    expect(formatUSD(1234)).toBe("$1,234");
    expect(formatUSD(0)).toBe("$0");
    expect(formatUSD(1234.9)).toBe("$1,235");
  });

  it("formatCurrency handles known currencies", () => {
    expect(formatCurrency(1234, "USD")).toContain("1,234");
    expect(formatCurrency(1234, "ILS")).toMatch(/1,234|1234/);
    expect(formatCurrency(1234, "EUR")).toMatch(/1,234|1234/);
  });

  it("formatCurrency degrades gracefully on unknown code", () => {
    // Intl.NumberFormat can insert non-breaking spaces in some
    // locales/runtimes, so normalize whitespace before comparing.
    const raw = formatCurrency(1234, "ZZZ");
    expect(raw.replace(/\s+/g, " ")).toBe("ZZZ 1,234");
  });

  it("formatDateRange returns null on both empty", () => {
    expect(formatDateRange(null, null)).toBeNull();
    expect(formatDateRange(undefined, undefined)).toBeNull();
  });

  it("formatDateRange returns single date when only one is set", () => {
    expect(formatDateRange("2026-09-20", null)).toBe("2026-09-20");
    expect(formatDateRange(null, "2026-09-27")).toBe("2026-09-27");
  });

  it("formatDateRange joins both dates with arrow", () => {
    expect(formatDateRange("2026-09-20", "2026-09-27")).toBe(
      "2026-09-20 → 2026-09-27",
    );
  });

  it("formatDurationHours handles whole hours", () => {
    expect(formatDurationHours(3)).toBe("3h");
    expect(formatDurationHours(0)).toBe("0h");
  });

  it("formatDurationHours handles fractional hours", () => {
    expect(formatDurationHours(3.5)).toBe("3h 30m");
    expect(formatDurationHours(3.75)).toBe("3h 45m");
  });
});
