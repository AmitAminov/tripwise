"use client";

import { useState, useTransition } from "react";
import { submitPlanNow } from "./actions";
import { INTEREST_OPTIONS } from "@/lib/types/trip-intent";
import { DESTINATIONS } from "@/data/destinations";

/* ---------- shared style tokens ---------- */
const selectedCard =
  "bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)] shadow-sm";
const unselectedCard =
  "bg-[color:var(--color-surface)] text-[color:var(--color-fg)] border-[color:var(--color-line)] hover:border-[color:var(--color-line-2)]";

const COMFORT_LEVELS = [
  { value: "budget", label: "Budget" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
] as const;
const PACES = [
  { value: "relaxed", label: "Relaxed", hint: "Long meals, unhurried" },
  { value: "balanced", label: "Balanced", hint: "Some plans, some drift" },
  { value: "packed", label: "Packed", hint: "See everything" },
] as const;
const GROUP_TYPES = [
  { value: "couple", label: "Couple" },
  { value: "solo", label: "Solo" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "business_leisure", label: "Bleisure" },
] as const;
const ACCOMMODATION_TYPES = [
  "hotel",
  "apartment",
  "villa",
  "hostel",
  "resort",
] as const;
const ACCOMMODATION_AMENITIES = [
  "central",
  "quiet",
  "pool",
  "kitchen",
  "parking",
  "family_rooms",
  "gym",
  "wifi",
] as const;
const DIETARY = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "kosher",
  "halal",
  "nut_allergy",
] as const;
const VISA_TOLERANCE = [
  { value: "low", label: "Prefer visa-free" },
  { value: "medium", label: "OK with e-visa" },
  { value: "high", label: "Any is fine" },
] as const;
const SAFETY_TOLERANCE = [
  { value: "low", label: "Very safe only" },
  { value: "medium", label: "Standard vigilance OK" },
  { value: "high", label: "Adventurous" },
] as const;

/* ---------- component ---------- */

export function IntermediateSurvey({ deep }: { deep?: boolean }) {
  const [candidates, setCandidates] = useState<string[]>(
    DESTINATIONS.map((d) => d.id),
  );
  const [interests, setInterests] = useState<string[]>([
    "food",
    "culture",
    "architecture",
  ]);
  const [comfort, setComfort] = useState("standard");
  const [pace, setPace] = useState("balanced");
  const [groupType, setGroupType] = useState("couple");
  const [directOnly, setDirectOnly] = useState(false);
  const [hiddenGems, setHiddenGems] = useState(true);
  const [iconicLandmarks, setIconicLandmarks] = useState(true);
  const [avoidLongWalks, setAvoidLongWalks] = useState(false);
  const [avoidDriving, setAvoidDriving] = useState(false);
  const [visaTol, setVisaTol] = useState("medium");
  const [safetyTol, setSafetyTol] = useState("medium");
  const [accommodationTypes, setAccommodationTypes] = useState<string[]>([
    "hotel",
    "apartment",
  ]);
  const [accommodationAmenities, setAccommodationAmenities] = useState<
    string[]
  >(["central", "wifi"]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  async function onSubmit(formData: FormData) {
    candidates.forEach((c) => formData.append("candidates", c));
    interests.forEach((i) => formData.append("interests", i));
    formData.set("comfort", comfort);
    formData.set("pace", pace);
    // Extra fields are informational — Plan Now action stores what it uses;
    // the rest is captured in the intent JSON when we add richer submit.
    startTransition(() => submitPlanNow(formData));
  }

  return (
    <form action={onSubmit} className="space-y-8">
      {/* Destinations */}
      <Section title="Which destinations are we comparing?">
        <div className="grid gap-2 sm:grid-cols-3">
          {DESTINATIONS.map((d) => {
            const on = candidates.includes(d.id);
            return (
              <ChoiceCard
                key={d.id}
                on={on}
                onClick={() => toggle(candidates, setCandidates, d.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{d.name}</div>
                  <Check on={on} />
                </div>
                <div
                  className={`text-xs ${on ? "text-white/70" : "text-[color:var(--color-muted)]"}`}
                >
                  {d.country}
                </div>
              </ChoiceCard>
            );
          })}
        </div>
      </Section>

      {/* Origin */}
      <Section title="Where are you flying from?">
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label="Origin city"
            name="origin_city"
            defaultValue="Tel Aviv"
          />
          <LabeledInput
            label="Home airport (IATA)"
            name="home_airport"
            defaultValue="TLV"
            maxLength={3}
            uppercase
          />
        </div>
      </Section>

      {/* Dates */}
      <Section title="When?">
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            type="date"
            label="Start"
            name="start_date"
            defaultValue="2026-09-20"
          />
          <LabeledInput
            type="date"
            label="End"
            name="end_date"
            defaultValue="2026-09-27"
          />
        </div>
      </Section>

      {/* Group */}
      <Section title="Who's going?">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <LabeledInput
            type="number"
            label="Adults"
            name="adults"
            defaultValue="2"
            min={1}
            max={10}
          />
          <LabeledInput
            type="number"
            label="Children"
            name="children"
            defaultValue="0"
            min={0}
            max={10}
          />
          <LabeledInput
            type="number"
            label="Seniors"
            name="seniors"
            defaultValue="0"
            min={0}
            max={10}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {GROUP_TYPES.map((g) => (
            <Chip
              key={g.value}
              on={groupType === g.value}
              onClick={() => setGroupType(g.value)}
            >
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Budget */}
      <Section title="Budget">
        <LabeledInput
          type="number"
          label="Per person (USD)"
          name="budget_per_person"
          defaultValue="1500"
          min={100}
          step={50}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {COMFORT_LEVELS.map((c) => (
            <Chip
              key={c.value}
              on={comfort === c.value}
              onClick={() => setComfort(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Vibe */}
      <Section title="What are you into?">
        <div className="flex flex-wrap gap-2 mb-4">
          {INTEREST_OPTIONS.map((tag) => (
            <Chip
              key={tag}
              on={interests.includes(tag)}
              onClick={() => toggle(interests, setInterests, tag)}
              className="capitalize"
            >
              {tag.replace(/_/g, " ")}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PACES.map((p) => (
            <ChoiceCard
              key={p.value}
              on={pace === p.value}
              onClick={() => setPace(p.value)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                <Check on={pace === p.value} />
              </div>
              <div
                className={`text-xs mt-1 ${pace === p.value ? "text-white/70" : "text-[color:var(--color-muted)]"}`}
              >
                {p.hint}
              </div>
            </ChoiceCard>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on={hiddenGems} onClick={() => setHiddenGems((v) => !v)}>
            Hidden gems
          </Chip>
          <Chip
            on={iconicLandmarks}
            onClick={() => setIconicLandmarks((v) => !v)}
          >
            Iconic landmarks
          </Chip>
        </div>
      </Section>

      {/* Flight prefs */}
      <Section title="Flight preferences">
        <div className="flex flex-wrap gap-2 mb-3">
          <Chip on={directOnly} onClick={() => setDirectOnly((v) => !v)}>
            Direct only
          </Chip>
          <Chip
            on={avoidLongWalks}
            onClick={() => setAvoidLongWalks((v) => !v)}
          >
            Avoid long walks
          </Chip>
          <Chip on={avoidDriving} onClick={() => setAvoidDriving((v) => !v)}>
            Avoid driving
          </Chip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            type="number"
            label="Max flight duration (h)"
            name="max_flight_duration_hours"
            defaultValue="14"
            min={2}
            max={30}
          />
          <LabeledInput
            label="Preferred airlines (optional)"
            name="preferred_airlines"
            placeholder="LY, TP, BA"
          />
        </div>
      </Section>

      {/* Accommodation */}
      <Section title="Where do you like to stay?">
        <div className="flex flex-wrap gap-2 mb-3">
          {ACCOMMODATION_TYPES.map((t) => (
            <Chip
              key={t}
              on={accommodationTypes.includes(t)}
              onClick={() =>
                toggle(accommodationTypes, setAccommodationTypes, t)
              }
              className="capitalize"
            >
              {t}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCOMMODATION_AMENITIES.map((a) => (
            <Chip
              key={a}
              on={accommodationAmenities.includes(a)}
              onClick={() =>
                toggle(
                  accommodationAmenities,
                  setAccommodationAmenities,
                  a,
                )
              }
              className="capitalize"
            >
              {a.replace(/_/g, " ")}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Dietary */}
      <Section title="Dietary needs">
        <div className="flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <Chip
              key={d}
              on={dietary.includes(d)}
              onClick={() => toggle(dietary, setDietary, d)}
              className="capitalize"
            >
              {d.replace(/_/g, " ")}
            </Chip>
          ))}
        </div>
      </Section>

      {/* Deep-only sections */}
      {deep && (
        <>
          <Section title="Tolerances">
            <div className="mb-3">
              <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
                Visa complexity
              </div>
              <div className="flex flex-wrap gap-2">
                {VISA_TOLERANCE.map((v) => (
                  <Chip
                    key={v.value}
                    on={visaTol === v.value}
                    onClick={() => setVisaTol(v.value)}
                  >
                    {v.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
                Safety risk
              </div>
              <div className="flex flex-wrap gap-2">
                {SAFETY_TOLERANCE.map((v) => (
                  <Chip
                    key={v.value}
                    on={safetyTol === v.value}
                    onClick={() => setSafetyTol(v.value)}
                  >
                    {v.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Must-have / avoid (freeform)">
            <div className="grid gap-3">
              <LabeledInput
                label="Must-have"
                name="must_have"
                placeholder="sunset drinks, at least one museum, a spa afternoon"
              />
              <LabeledInput
                label="Avoid"
                name="avoid"
                placeholder="crowded queues, chain restaurants, early mornings"
              />
            </div>
          </Section>
        </>
      )}

      <div className="pt-4 border-t border-[color:var(--color-line)]">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full"
        >
          {pending
            ? "Ranking destinations..."
            : deep
              ? "Run deep research →"
              : "Rank the destinations →"}
        </button>
      </div>
    </form>
  );
}

/* ---------- shared building blocks ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="field-label mb-3">{title}</legend>
      {children}
    </fieldset>
  );
}

function ChoiceCard({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[var(--radius)] p-3 border transition-all ${
        on ? selectedCard : unselectedCard
      }`}
      aria-pressed={on}
    >
      {children}
    </button>
  );
}

function Chip({
  on,
  onClick,
  children,
  className = "",
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm border transition-all ${
        on ? selectedCard : unselectedCard
      } ${className}`}
      aria-pressed={on}
    >
      {children}
    </button>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`ml-2 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
        on
          ? "bg-white text-[color:var(--color-primary)]"
          : "border border-[color:var(--color-line-2)] text-transparent"
      }`}
      aria-hidden
    >
      ✓
    </span>
  );
}

function LabeledInput({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  min,
  max,
  step,
  maxLength,
  uppercase,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  uppercase?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[color:var(--color-muted)] mb-1 block">
        {label}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        className={`field ${uppercase ? "uppercase" : ""}`}
      />
    </label>
  );
}
