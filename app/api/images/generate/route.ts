/**
 * POST /api/images/generate
 * body: { prompt: string, purpose?: "destination_hero" | "trip_poster" | "attraction_fallback" }
 *
 * Server-side proxy so the Gemini API key never touches the client.
 * Response: { url: "data:image/png;base64,...", model, cacheKey } on
 * success, or { error } on failure.
 *
 * Rate-cap: keyed by user + minute so a single client can't burn the
 * quota. In-memory (per instance), so restart resets counters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { imageProvider, placesProvider } from "@/lib/providers";

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 8;

function checkRate(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, { url: string; storedAt: number }>();

function cacheKey(prompt: string, purpose: string): string {
  let h = 5381;
  const src = `${purpose}|${prompt}`;
  for (let i = 0; i < src.length; i++) {
    h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

interface FallbackCoords {
  name: string;
  lat: number;
  lng: number;
}

export async function POST(request: NextRequest) {
  let body: {
    prompt?: unknown;
    purpose?: unknown;
    aspect?: unknown;
    fallback?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const purpose =
    typeof body.purpose === "string" &&
    ["destination_hero", "trip_poster", "attraction_fallback"].includes(
      body.purpose,
    )
      ? (body.purpose as
          | "destination_hero"
          | "trip_poster"
          | "attraction_fallback")
      : "destination_hero";
  const aspect =
    typeof body.aspect === "string" &&
    ["16:9", "4:5", "1:1", "3:2"].includes(body.aspect)
      ? (body.aspect as "16:9" | "4:5" | "1:1" | "3:2")
      : "16:9";

  // Optional fallback for spec's "Gemini failure → provider photos or
  // neutral destination imagery" reliability rule. Client passes the
  // destination it's asking about; on Gemini failure we look up a
  // Places photo and return that instead.
  const fallback: FallbackCoords | null =
    body.fallback &&
    typeof body.fallback === "object" &&
    typeof (body.fallback as FallbackCoords).lat === "number" &&
    typeof (body.fallback as FallbackCoords).lng === "number"
      ? (body.fallback as FallbackCoords)
      : null;

  if (prompt.length < 10 || prompt.length > 2000) {
    return NextResponse.json(
      { error: "Prompt must be 10-2000 characters." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!checkRate(user.id)) {
    return NextResponse.json(
      { error: "Slow down — 8 images per minute limit." },
      { status: 429 },
    );
  }

  const key = cacheKey(prompt, `${purpose}:${aspect}`);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      url: cached.url,
      cacheKey: key,
      model: "gemini-2.5-flash-image",
      cached: true,
    });
  }

  const provider = imageProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Image provider not configured (GEMINI_API_KEY missing)." },
      { status: 503 },
    );
  }

  const result = await provider.generate({
    prompt,
    aspect,
    purpose,
  });

  if (result.status === "error" || !result.data) {
    // Spec's reliability rule: "Gemini failure → provider photos or
    // neutral destination imagery". Try Places nearest-attraction
    // photo if the client gave us fallback coords.
    if (fallback) {
      const places = placesProvider();
      if (places) {
        try {
          const search = await places.search({
            center: { lat: fallback.lat, lng: fallback.lng },
            kind: "attractions",
            limit: 20,
          });
          const withPhoto = search.data?.find((p) => p.photoUrl);
          if (withPhoto?.photoUrl) {
            return NextResponse.json({
              url: withPhoto.photoUrl,
              cacheKey: key,
              model: "google-places-photo",
              cached: false,
              source: "places-fallback",
              fallbackAttraction: withPhoto.name,
              geminiError: result.error,
            });
          }
        } catch {
          // fall through to the plain error path
        }
      }
    }

    return NextResponse.json(
      { error: result.error ?? "Image generation failed." },
      { status: 502 },
    );
  }

  cache.set(key, { url: result.data.url, storedAt: Date.now() });

  return NextResponse.json({
    url: result.data.url,
    cacheKey: key,
    model: result.data.model,
    cached: false,
    source: "gemini",
  });
}
