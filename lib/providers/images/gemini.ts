/**
 * ImageProvider backed by Google's Gemini image models via AI Studio.
 * Wired in now so that the moment you upgrade to a paid tier the
 * destination heroes and trip posters light up — no code change needed.
 *
 * Model selection: gemini-2.5-flash-image (Nano Banana) is the current
 * production alias. Newer 3.x models exist but Nano Banana is fine for
 * editorial travel imagery.
 *
 * NOTE: Free tier has a quota of 0 for image generation across all
 * image models (returns 429 immediately). Detect and surface that
 * clearly in the ProviderResult.
 */

import type {
  GeneratedImage,
  ImageGenerationQuery,
  ImageProvider,
  ProviderResult,
} from "@/lib/providers/types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

function cacheKey(q: ImageGenerationQuery): string {
  // Simple stable hash so callers can cache/dedupe. Not cryptographic.
  let h = 5381;
  const src = `${DEFAULT_MODEL}|${q.aspect}|${q.purpose}|${q.prompt}`;
  for (let i = 0; i < src.length; i++) {
    h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      inlineData?: { mimeType?: string; data?: string };
      text?: string;
    }>;
  };
}

export const geminiImageProvider: ImageProvider = {
  name: "gemini",

  async generate(
    q: ImageGenerationQuery,
  ): Promise<ProviderResult<GeneratedImage>> {
    const key = process.env.GEMINI_API_KEY;
    const now = new Date().toISOString();
    if (!key) {
      return {
        data: null,
        status: "error",
        source: "gemini",
        checkedAt: now,
        error: "GEMINI_API_KEY not set",
      };
    }

    const model = DEFAULT_MODEL;

    try {
      const res = await fetch(
        `${BASE}/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: q.prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
            },
          }),
          // Spec's image-gen budget (sync mode).
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (res.status === 429) {
        const detail = await res.text().catch(() => "");
        const quotaZero = /limit: 0/.test(detail);
        return {
          data: null,
          status: "error",
          source: "gemini",
          checkedAt: now,
          error: quotaZero
            ? "Free tier has 0 image-gen quota. Upgrade at https://aistudio.google.com/plan."
            : `Rate limited: ${detail.slice(0, 200)}`,
        };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          data: null,
          status: "error",
          source: "gemini",
          checkedAt: now,
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as { candidates?: GeminiCandidate[] };
      const inline = data.candidates
        ?.flatMap((c) => c.content?.parts ?? [])
        .find((p) => p.inlineData?.data);

      if (!inline?.inlineData?.data) {
        return {
          data: null,
          status: "error",
          source: "gemini",
          checkedAt: now,
          error: "no inline image in response",
        };
      }

      const mime = inline.inlineData.mimeType ?? "image/png";
      const url = `data:${mime};base64,${inline.inlineData.data}`;

      return {
        data: {
          url,
          aspect: q.aspect,
          model,
          prompt: q.prompt,
          cacheKey: cacheKey(q),
          createdAt: now,
        },
        status: "live_checked",
        source: "gemini",
        checkedAt: now,
      };
    } catch (e) {
      return {
        data: null,
        status: "error",
        source: "gemini",
        checkedAt: now,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
