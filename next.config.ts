import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
