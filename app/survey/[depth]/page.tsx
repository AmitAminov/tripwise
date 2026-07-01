import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { PlanNowSurvey } from "./plan-now-survey";
import { IntermediateSurvey } from "./intermediate-survey";
import type { PlanningDepth } from "@/lib/types/trip-intent";

const DEPTHS: readonly PlanningDepth[] = [
  "plan_now",
  "intermediate",
  "deep_research",
];

function isDepth(v: string): v is PlanningDepth {
  return (DEPTHS as readonly string[]).includes(v);
}

const DEPTH_META: Record<PlanningDepth, { title: string; subtitle: string }> = {
  plan_now: {
    title: "Plan Now",
    subtitle: "5 questions. Fast estimates, top attractions, quick draft.",
  },
  intermediate: {
    title: "Intermediate",
    subtitle:
      "12–18 questions. Live flight search, events, lodging estimates, day-by-day plan.",
  },
  deep_research: {
    title: "Deep Research",
    subtitle:
      "25+ questions. Preference matching, alternatives, visa/logistics, decision report.",
  },
};

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ depth: string }>;
}) {
  const { depth } = await params;
  if (!isDepth(depth)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = DEPTH_META[depth];

  return (
    <>
      <Header email={user?.email} />
      <main className="max-w-2xl mx-auto p-6 py-10">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]"
          >
            ← Home
          </Link>
        </div>
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            {meta.title}
          </div>
          <h1 className="font-serif text-3xl leading-tight mb-2">
            Tell us about the trip
          </h1>
          <p className="text-[color:var(--color-fg-2)]">{meta.subtitle}</p>
        </div>

        {depth === "plan_now" && <PlanNowSurvey />}
        {depth === "intermediate" && <IntermediateSurvey />}
        {depth === "deep_research" && <IntermediateSurvey deep />}
      </main>
    </>
  );
}
