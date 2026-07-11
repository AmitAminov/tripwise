import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Google Secret Manager client is Node-only (uses `path`, `google-gax`,
  // grpc). Keep it out of the webpack bundle so it's require()'d at runtime —
  // otherwise instrumentation.ts / lib/secrets.ts fail with "Can't resolve 'path'".
  serverExternalPackages: ["@google-cloud/secret-manager", "google-gax"],
  images: {
    remotePatterns: [
      // Google Places photo endpoint returns image bytes at
      //   /v1/{photoName}/media?maxHeightPx=...&key=...
      { protocol: "https", hostname: "places.googleapis.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      // Gemini-generated images will be data URIs (base64) rather than
      // remote URLs, so no domain is needed for those.
    ],
  },
};

export default nextConfig;
