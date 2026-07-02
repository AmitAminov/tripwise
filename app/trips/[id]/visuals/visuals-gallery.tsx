"use client";

import { useState, useTransition } from "react";
import {
  destinationHeroPrompt,
  moodBoardPrompt,
  tripPosterPrompt,
} from "@/lib/image-prompts";

type Slot = {
  key: string;
  title: string;
  prompt: string;
  purpose: "destination_hero" | "trip_poster" | "attraction_fallback";
  aspect: "16:9" | "4:5";
};

export function VisualsGallery({
  destinationName,
  country,
  durationDays,
}: {
  destinationName: string;
  country: string;
  durationDays: number;
}) {
  const slots: Slot[] = [
    {
      key: "hero",
      title: "Editorial hero",
      prompt: destinationHeroPrompt({
        destinationName,
        country,
      }),
      purpose: "destination_hero",
      aspect: "16:9",
    },
    {
      key: "food",
      title: "Food scene",
      prompt: moodBoardPrompt({
        destinationName,
        moodDescriptor: "food scene, warm cafés, street eats",
      }),
      purpose: "attraction_fallback",
      aspect: "16:9",
    },
    {
      key: "arch",
      title: "Architecture",
      prompt: moodBoardPrompt({
        destinationName,
        moodDescriptor: "iconic architecture and hidden streets",
      }),
      purpose: "attraction_fallback",
      aspect: "16:9",
    },
    {
      key: "poster",
      title: "Trip poster",
      prompt: tripPosterPrompt({
        destinationName,
        durationDays,
        groupType: "couple",
        interests: ["food", "architecture", "culture"],
      }),
      purpose: "trip_poster",
      aspect: "4:5",
    },
  ];

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  async function generate(slot: Slot) {
    setErrors((e) => ({ ...e, [slot.key]: "" }));
    setBusy((b) => ({ ...b, [slot.key]: true }));
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: slot.prompt,
          purpose: slot.purpose,
          aspect: slot.aspect,
        }),
      });
      const body = (await res.json()) as {
        url?: string;
        error?: string;
        cached?: boolean;
      };
      if (!res.ok || !body.url) {
        setErrors((e) => ({
          ...e,
          [slot.key]: body.error ?? `HTTP ${res.status}`,
        }));
      } else {
        setUrls((u) => ({ ...u, [slot.key]: body.url! }));
      }
    } catch (e) {
      setErrors((err) => ({
        ...err,
        [slot.key]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy((b) => ({ ...b, [slot.key]: false }));
    }
  }

  async function generateAll() {
    startTransition(async () => {
      for (const slot of slots) {
        if (urls[slot.key]) continue;
        // eslint-disable-next-line no-await-in-loop
        await generate(slot);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={generateAll} className="btn btn-primary">
          ✨ Generate all
        </button>
        <p className="text-xs text-[color:var(--color-muted)]">
          ~$0.04 per image on Google AI Studio Tier 1 · ~8s each · cached 6h
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {slots.map((slot) => {
          const url = urls[slot.key];
          const error = errors[slot.key];
          const isBusy = busy[slot.key];
          const isPortrait = slot.aspect === "4:5";
          return (
            <div key={slot.key} className="card overflow-hidden">
              <div
                className="relative bg-[color:var(--color-surface-2)]"
                style={{ aspectRatio: isPortrait ? "4 / 5" : "16 / 9" }}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`${slot.title} — ${destinationName}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[color:var(--color-muted)] text-sm">
                    {isBusy ? "Generating…" : "Click generate to render"}
                  </div>
                )}
                {url && (
                  <div className="absolute top-3 right-3 text-[10px] uppercase tracking-widest text-white bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                    AI · Nano Banana
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{slot.title}</div>
                  <button
                    onClick={() => generate(slot)}
                    disabled={isBusy}
                    className="btn btn-ghost text-xs"
                  >
                    {isBusy ? "..." : url ? "Regenerate" : "Generate"}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-[color:var(--color-danger)] mb-2">
                    {error}
                  </p>
                )}
                <details className="text-xs text-[color:var(--color-muted)]">
                  <summary className="cursor-pointer">Show prompt</summary>
                  <p className="mt-2 text-[color:var(--color-fg-2)] leading-relaxed">
                    {slot.prompt}
                  </p>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
