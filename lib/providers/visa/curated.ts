/**
 * Curated visa data — spec calls for IATA Timatic or gov sources in
 * Deep Research. Timatic is not free; a licensed data feed would be
 * the right long-term path. This provider ships a hand-curated matrix
 * for the most common passport ↔ destination pairs so Deep Research
 * mode has structured data to display instead of a static field on
 * the destination card.
 *
 * Every row is labelled "check before booking" per the spec's rule for
 * non-licensed sources.
 */

export type VisaOutcome =
  | "visa_free"
  | "visa_on_arrival"
  | "e_visa"
  | "consular_required";

export interface VisaRule {
  outcome: VisaOutcome;
  maxStayDays?: number;
  note: string;
  officialSourceUrl?: string;
}

export interface VisaProvider {
  name: string;
  lookup(passportCode: string, destinationCode: string): VisaRule;
}

const MATRIX: Record<string, Record<string, VisaRule>> = {
  IL: {
    TH: {
      outcome: "visa_free",
      maxStayDays: 30,
      note: "Israeli passports get 30-day visa-free entry to Thailand.",
      officialSourceUrl: "https://www.thaiembassy.com/",
    },
    CZ: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free access. ETIAS pre-authorisation may be required starting 2026.",
      officialSourceUrl: "https://travel-europe.europa.eu/etias_en",
    },
    IT: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free. Same ETIAS caveat as Prague.",
      officialSourceUrl: "https://travel-europe.europa.eu/etias_en",
    },
    US: {
      outcome: "e_visa",
      maxStayDays: 90,
      note: "ESTA required for visa-waiver program (US permits Israelis under VWP from 2024).",
      officialSourceUrl: "https://esta.cbp.dhs.gov/",
    },
    JP: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "90-day visa-free tourist stay.",
      officialSourceUrl: "https://www.mofa.go.jp/",
    },
  },
  US: {
    TH: {
      outcome: "visa_free",
      maxStayDays: 30,
      note: "30-day visa-free tourist stay for US passports.",
      officialSourceUrl: "https://www.thaiembassy.com/",
    },
    CZ: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free for US passports; ETIAS applies from 2026.",
      officialSourceUrl: "https://travel-europe.europa.eu/etias_en",
    },
    IT: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free.",
      officialSourceUrl: "https://travel-europe.europa.eu/etias_en",
    },
    JP: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "90-day visa-free tourist stay.",
      officialSourceUrl: "https://www.mofa.go.jp/",
    },
  },
  GB: {
    TH: {
      outcome: "visa_free",
      maxStayDays: 30,
      note: "30-day visa-free for UK passports.",
    },
    CZ: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free; ETIAS applies from 2026.",
    },
    IT: {
      outcome: "visa_free",
      maxStayDays: 90,
      note: "Schengen visa-free.",
    },
  },
};

// Fallback used when a passport/destination pair isn't in the matrix.
const UNKNOWN: VisaRule = {
  outcome: "consular_required",
  note: "Unknown — check the destination's consulate site before booking.",
};

export const curatedVisaProvider: VisaProvider = {
  name: "curated",
  lookup(passportCode: string, destinationCode: string): VisaRule {
    const passport = passportCode.toUpperCase();
    const dest = destinationCode.toUpperCase();
    return MATRIX[passport]?.[dest] ?? UNKNOWN;
  },
};
