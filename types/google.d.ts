// Merged ambient declaration for the global `window.google` namespace.
// Both the GIS OAuth token client (Calendar export) and the Maps JS SDK
// (Map view) attach here; TS complained about redeclarations before this.

export {};

interface GoogleAccountsOauth2TokenClient {
  requestAccessToken: () => void;
}

interface GoogleAccountsOauth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: {
      access_token?: string;
      error?: string;
      error_description?: string;
    }) => void;
  }) => GoogleAccountsOauth2TokenClient;
}

interface GoogleMapsMap {
  setCenter: (p: { lat: number; lng: number }) => void;
  fitBounds: (bounds: GoogleMapsLatLngBounds) => void;
}

interface GoogleMapsMarker {
  setMap: (m: GoogleMapsMap | null) => void;
  addListener: (event: string, cb: () => void) => void;
}

interface GoogleMapsInfoWindow {
  open: (opts: { map: GoogleMapsMap; anchor: GoogleMapsMarker }) => void;
  close: () => void;
  setContent: (html: string) => void;
}

interface GoogleMapsLatLngBounds {
  extend: (p: { lat: number; lng: number }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOauth2;
      };
      maps?: {
        Map: new (
          el: HTMLElement,
          opts: Record<string, unknown>,
        ) => GoogleMapsMap;
        Marker: new (opts: Record<string, unknown>) => GoogleMapsMarker;
        InfoWindow: new (
          opts?: Record<string, unknown>,
        ) => GoogleMapsInfoWindow;
        Size: new (w: number, h: number) => unknown;
        SymbolPath?: { CIRCLE: number };
        LatLngBounds: new () => GoogleMapsLatLngBounds;
      };
    };
  }
}
