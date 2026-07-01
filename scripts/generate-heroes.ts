#!/usr/bin/env bun
/**
 * Pre-generates hero images for each destination in data/destinations.ts
 * and writes them to public/destinations/{id}.png.
 *
 * Run once:
 *   bun run scripts/generate-heroes.ts
 *
 * Costs ~$0.04 per image on Google AI Studio Tier 1. 3 destinations
 * currently -> ~$0.12 to regenerate everything.
 *
 * Uses GEMINI_API_KEY from process.env — Bun auto-loads .env.local.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DESTINATIONS } from "../data/destinations";

interface HeroSpec {
  id: string;
  prompt: string;
}

function heroPromptFor(d: (typeof DESTINATIONS)[number]): string {
  const base =
    "Editorial travel photograph in the style of a premium travel magazine cover. Warm cinematic light, shallow depth of field, no text, no logos, no watermarks, no people front-and-center. Aspect ratio 16:9.";

  const perDestination: Record<string, string> = {
    bangkok:
      "Bangkok at dusk: golden temple spires rising above the Chao Phraya river, a longtail boat cutting through orange-mirror water, warm humid haze, distant skyline glow.",
    prague:
      "Prague at golden hour: Charles Bridge with its statues in silhouette, baroque spires and red rooftops in the background, warm autumn light on the Vltava, faint mist over the river.",
    south_italy:
      "Amalfi coast at late afternoon: pastel cliffside villages of Positano tumbling down to a turquoise sea, lemon terraces, a small fishing boat, warm Mediterranean light with soft cloud detail.",
  };

  return `${perDestination[d.id] ?? `${d.name}, ${d.country}, iconic view`} ${base}`;
}

async function generateImage(prompt: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string } }> };
    }>;
  };

  const b64 = data.candidates
    ?.flatMap((c) => c.content?.parts ?? [])
    .find((p) => p.inlineData?.data)?.inlineData?.data;

  if (!b64) throw new Error("No inline image returned");
  return Buffer.from(b64, "base64");
}

async function main() {
  const outDir = join(process.cwd(), "public", "destinations");
  await mkdir(outDir, { recursive: true });

  const specs: HeroSpec[] = DESTINATIONS.map((d) => ({
    id: d.id,
    prompt: heroPromptFor(d),
  }));

  for (const spec of specs) {
    const outPath = join(outDir, `${spec.id}.png`);
    console.log(`→ ${spec.id}: generating...`);
    try {
      const start = Date.now();
      const bytes = await generateImage(spec.prompt);
      await writeFile(outPath, bytes);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${outPath} (${bytes.length} bytes, ${elapsed}s)`);
    } catch (e) {
      console.error(
        `  FAILED: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
