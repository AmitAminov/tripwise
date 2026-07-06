/**
 * Country name → ISO-3166 alpha-2 code → emoji flag.
 * Covers the seeded destination set. Add rows as new countries come online.
 */

const COUNTRY_TO_ISO2: Record<string, string> = {
  Thailand: "TH",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Italy: "IT",
  France: "FR",
  "United Kingdom": "GB",
  UK: "GB",
  Netherlands: "NL",
  Spain: "ES",
  Austria: "AT",
  Germany: "DE",
  Portugal: "PT",
  Greece: "GR",
  Denmark: "DK",
  Iceland: "IS",
  Switzerland: "CH",
  Hungary: "HU",
  Poland: "PL",
  Croatia: "HR",
  Turkey: "TR",
  Morocco: "MA",
  Egypt: "EG",
  Jordan: "JO",
  UAE: "AE",
  "United Arab Emirates": "AE",
  India: "IN",
  Nepal: "NP",
  Indonesia: "ID",
  Singapore: "SG",
  Vietnam: "VN",
  Japan: "JP",
  "South Korea": "KR",
  Taiwan: "TW",
  Philippines: "PH",
  "Hong Kong SAR": "HK",
  "Hong Kong": "HK",
  Australia: "AU",
  "New Zealand": "NZ",
  "South Africa": "ZA",
  Kenya: "KE",
  Tanzania: "TZ",
  "United States": "US",
  USA: "US",
  Canada: "CA",
  Mexico: "MX",
  Argentina: "AR",
  Brazil: "BR",
  Peru: "PE",
  Colombia: "CO",
  Cuba: "CU",
  Israel: "IL",
};

/**
 * Emoji flag from an ISO-3166 alpha-2 code (e.g. "FR" → 🇫🇷).
 * Uses Unicode regional indicator symbols.
 */
export function flagFromIso2(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  const A = 0x1f1e6; // regional indicator A
  const cp0 = iso2.toUpperCase().charCodeAt(0) - 65 + A;
  const cp1 = iso2.toUpperCase().charCodeAt(1) - 65 + A;
  return String.fromCodePoint(cp0, cp1);
}

/** Country name → emoji flag. Empty string when unknown. */
export function flagForCountry(country: string): string {
  const iso = COUNTRY_TO_ISO2[country];
  return iso ? flagFromIso2(iso) : "";
}

/** ISO-3166 alpha-2 code for a country name. Empty string when unknown. */
export function iso2ForCountry(country: string): string {
  return COUNTRY_TO_ISO2[country] ?? "";
}
