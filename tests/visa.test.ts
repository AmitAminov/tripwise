import { describe, it, expect } from "vitest";
import { curatedVisaProvider } from "@/lib/providers/visa/curated";

describe("curated visa provider", () => {
  it("returns visa-free for Israeli passport → Thailand", () => {
    const rule = curatedVisaProvider.lookup("IL", "TH");
    expect(rule.outcome).toBe("visa_free");
    expect(rule.maxStayDays).toBe(30);
  });

  it("returns visa-free with Schengen note for IL → CZ", () => {
    const rule = curatedVisaProvider.lookup("IL", "CZ");
    expect(rule.outcome).toBe("visa_free");
    expect(rule.note.toLowerCase()).toMatch(/schengen|etias/);
  });

  it("returns consular_required for unknown pairs", () => {
    const rule = curatedVisaProvider.lookup("ZZ", "YY");
    expect(rule.outcome).toBe("consular_required");
  });

  it("is case-insensitive on codes", () => {
    const a = curatedVisaProvider.lookup("il", "th");
    const b = curatedVisaProvider.lookup("IL", "TH");
    expect(a.outcome).toBe(b.outcome);
  });
});
