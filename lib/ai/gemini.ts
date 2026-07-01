/**
 * Thin server-only client for the Google AI Studio Gemini API.
 * Text generation only — image generation is paid-tier and we degrade
 * gracefully at the call site instead of trying to hide the paywall.
 *
 * Never import from a client component. GEMINI_API_KEY must stay server-side.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function generateText(params: {
  prompt: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseSchema?: unknown;
}): Promise<GeminiTextResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY not set" };

  const model = params.model ?? "gemini-2.5-flash";
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig: {
      maxOutputTokens: params.maxOutputTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    },
  };

  if (params.responseSchema) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
    (body.generationConfig as Record<string, unknown>).responseSchema =
      params.responseSchema;
  }

  try {
    const res = await fetch(
      `${BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // Spec's generic AI-call budget: 30s max sync.
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${res.status}: ${text.slice(0, 400)}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) return { ok: false, error: "empty response" };
    return { ok: true, text };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
