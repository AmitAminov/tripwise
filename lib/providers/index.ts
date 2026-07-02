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
import { deepLinkHotelProvider } from "./hotels/deep-links";
import { liteapiHotelProvider } from "./hotels/liteapi";
import { curatedEventsProvider } from "./events/curated";
import { compositeEventsProvider } from "./events/composite";
import { openMeteoProvider } from "./weather/openmeteo";
import type {
  EventsProvider,
  FlightProvider,
  HotelProvider,
  ImageProvider,
  PlacesProvider,
  WeatherProvider,
} from "./types";

export function flightProvider(): FlightProvider {
  if (process.env.FAST_FLIGHTS_BASE_URL) {
    return fastFlightsProvider;
  }
  return mockFlightProvider;
}

export function placesProvider(): PlacesProvider | null {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;
  return googlePlacesProvider;
}

export function eventsProvider(): EventsProvider {
  // Composite = PredictHQ + curated when the PredictHQ key is available,
  // otherwise curated-only. Always returns SOMETHING.
  if (process.env.PREDICTHQ_API_KEY) return compositeEventsProvider;
  return curatedEventsProvider;
}

export function hotelProvider(): HotelProvider {
  // LiteAPI when the key is set; falls back internally to deep-links.
  if (process.env.LITEAPI_API_KEY) return liteapiHotelProvider;
  return deepLinkHotelProvider;
}

export function imageProvider(): ImageProvider | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return geminiImageProvider;
}

export function weatherProvider(): WeatherProvider {
  // Open-Meteo is free and requires no key. Always available.
  return openMeteoProvider;
}
