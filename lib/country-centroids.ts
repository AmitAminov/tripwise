/**
 * Rough geographic centroid per country. Used together with a
 * directional word in the destination text ("south italy",
 * "northern france", etc.) to filter Places results by the correct
 * half of the country — south of Italy's centroid, north of France's,
 * and so on.
 *
 * Values are eyeballed from the country's rough visual centre — not
 * the exact geographic centroid, which for irregular shapes (Norway,
 * Chile) can land outside the country. Half-space filtering doesn't
 * need pixel accuracy.
 */

export interface Centroid {
  lat: number;
  lng: number;
}

export const COUNTRY_CENTROIDS: Record<string, Centroid> = {
  // Europe
  Italy: { lat: 42.5, lng: 12.5 },
  France: { lat: 46.6, lng: 2.5 },
  Spain: { lat: 40.4, lng: -3.7 },
  Portugal: { lat: 39.4, lng: -8.2 },
  Germany: { lat: 51.2, lng: 10.4 },
  "United Kingdom": { lat: 54.3, lng: -2.4 },
  Ireland: { lat: 53.4, lng: -8.2 },
  Netherlands: { lat: 52.1, lng: 5.3 },
  Belgium: { lat: 50.5, lng: 4.5 },
  Austria: { lat: 47.5, lng: 14.5 },
  Switzerland: { lat: 46.8, lng: 8.2 },
  Denmark: { lat: 56.3, lng: 9.5 },
  Sweden: { lat: 60.1, lng: 15.4 },
  Norway: { lat: 62.5, lng: 10.7 },
  Finland: { lat: 63.9, lng: 26.0 },
  Poland: { lat: 52.2, lng: 19.1 },
  "Czech Republic": { lat: 49.8, lng: 15.5 },
  Czechia: { lat: 49.8, lng: 15.5 },
  Hungary: { lat: 47.2, lng: 19.4 },
  Croatia: { lat: 45.1, lng: 15.2 },
  Greece: { lat: 38.5, lng: 22.9 },
  Turkey: { lat: 39.0, lng: 35.2 },
  Iceland: { lat: 64.1, lng: -19.9 },

  // Middle East / North Africa
  Israel: { lat: 31.5, lng: 34.9 },
  Jordan: { lat: 31.3, lng: 36.8 },
  Egypt: { lat: 26.8, lng: 30.8 },
  Morocco: { lat: 31.8, lng: -6.8 },
  UAE: { lat: 23.4, lng: 53.8 },
  "United Arab Emirates": { lat: 23.4, lng: 53.8 },

  // Asia
  India: { lat: 20.6, lng: 78.9 },
  Nepal: { lat: 28.4, lng: 84.1 },
  Indonesia: { lat: -2.5, lng: 118.0 },
  Singapore: { lat: 1.35, lng: 103.8 },
  Thailand: { lat: 15.9, lng: 100.9 },
  Vietnam: { lat: 14.1, lng: 108.3 },
  Japan: { lat: 36.2, lng: 138.3 },
  "South Korea": { lat: 35.9, lng: 127.8 },
  Taiwan: { lat: 23.7, lng: 121.0 },
  Philippines: { lat: 13.0, lng: 121.8 },
  "Hong Kong": { lat: 22.4, lng: 114.2 },
  "Hong Kong SAR": { lat: 22.4, lng: 114.2 },

  // Oceania
  Australia: { lat: -25.3, lng: 133.8 },
  "New Zealand": { lat: -40.9, lng: 174.9 },

  // Africa (sub-Saharan)
  "South Africa": { lat: -30.6, lng: 22.9 },
  Kenya: { lat: 0.0, lng: 37.9 },
  Tanzania: { lat: -6.4, lng: 34.9 },

  // Americas
  "United States": { lat: 39.5, lng: -98.4 },
  USA: { lat: 39.5, lng: -98.4 },
  Canada: { lat: 56.1, lng: -106.3 },
  Mexico: { lat: 23.6, lng: -102.6 },
  Argentina: { lat: -38.4, lng: -63.6 },
  Brazil: { lat: -14.2, lng: -51.9 },
  Peru: { lat: -9.2, lng: -75.0 },
  Colombia: { lat: 4.6, lng: -74.3 },
  Cuba: { lat: 21.5, lng: -77.8 },
};

export function centroidFor(
  country: string | null | undefined,
): Centroid | null {
  if (!country) return null;
  return COUNTRY_CENTROIDS[country] ?? null;
}
