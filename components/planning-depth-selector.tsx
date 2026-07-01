import Link from "next/link";
import type { PlanningDepth } from "@/lib/types/trip-intent";

interface DepthOption {
  depth: PlanningDepth;
  title: string;
  tagline: string;
  timeEstimate: string;
  bullets: string[];
  accent: string;
  href: string;
  recommended?: boolean;
}

const OPTIONS: DepthOption[] = [
  {
    depth: "plan_now",
    title: "Plan Now",
    tagline: "For when the trip is next month.",
    timeEstimate: "3–5 minutes · 5–7 questions",
    bullets: [
      "Fast estimates, top attractions",
      "Draft itinerary in one pass",
      "Best when dates and destination are already loose ideas",
    ],
    accent: "var(--color-highlight)",
    href: "/survey/plan_now",
  },
  {
    depth: "intermediate",
    title: "Intermediate",
    tagline: "The right default for most trips.",
    timeEstimate: "10–15 minutes · 12–18 questions",
    bullets: [
      "Live flight search + events near your dates",
      "Lodging estimates, day-by-day itinerary",
      "Compare 2–3 real candidate destinations",
    ],
    accent: "var(--color-accent)",
    href: "/survey/intermediate",
    recommended: true,
  },
  {
    depth: "deep_research",
    title: "Deep Research",
    tagline: "For the trip that has to be right.",
    timeEstimate: "25+ minutes · 25+ questions",
    bullets: [
      "Preference matching, flight alternatives, lodging area analysis",
      "Visa + safety + logistics check",
      "Route optimization + decision report",
    ],
    accent: "var(--color-primary)",
    href: "/survey/deep_research",
  },
];

export function PlanningDepthSelector() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {OPTIONS.map((opt) => (
        <li key={opt.depth}>
          <Link
            href={opt.href}
            className="card block p-6 h-full relative group"
          >
            {opt.recommended && (
              <span
                className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full text-white"
                style={{ background: "var(--color-accent)" }}
              >
                Recommended
              </span>
            )}
            <div
              className="w-10 h-1 rounded-full mb-5"
              style={{ background: opt.accent }}
            />
            <h3 className="font-serif text-xl mb-1">{opt.title}</h3>
            <p className="text-sm text-[color:var(--color-fg-2)] mb-2">
              {opt.tagline}
            </p>
            <p className="text-xs text-[color:var(--color-muted)] mb-4">
              {opt.timeEstimate}
            </p>
            <ul className="space-y-2 text-sm text-[color:var(--color-fg-2)]">
              {opt.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span
                    className="text-[color:var(--color-accent)] mt-0.5 shrink-0"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-sm font-medium text-[color:var(--color-primary)]">
              Start →
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
