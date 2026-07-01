/**
 * Provider factories. Each returns the real implementation when the
 * corresponding API key/service is present in env, otherwise the mock
 * (or null if the surface can gracefully degrade).
 *
 * The swap from mock → real happens at env-config time, not at every
 * call site.
 */

import { mockFlightProvider } from "./flights/mock";
import { fastFlightsProvider } from "./flights/fast-flights";
import { googlePlacesProvider } from "./places/google";
import { geminiImageProvider } from "./images/gemini";
import type {
  EventsProvider,
  FlightProvider,
  HotelProvider,
  ImageProvider,
  PlacesProvider,
  WeatherProvider,
} from "./types";

export function flightProvider(): FlightProvider {
  // If FAST_FLIGHTS_BASE_URL is set, prefer the real scraper-backed
  // service. Falls through to mock on any transport error at call time.
  if (process.env.FAST_FLIGHTS_BASE_URL) {
    return fastFlightsProvider;
  }
  return mockFlightProvider;
}

export function placesProvider(): PlacesProvider | null {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;
  return googlePlacesProvider;
}

export function eventsProvider(): EventsProvider | null {
  return null;
}

export function hotelProvider(): HotelProvider | null {
  return null;
}

export function imageProvider(): ImageProvider | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return geminiImageProvider;
}

export function weatherProvider(): WeatherProvider | null {
  return null;
}
