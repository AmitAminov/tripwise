/**
 * Cartoon icons for the trip cornerstone tiles. Inline SVGs — no
 * dependency, ~1KB each, styled through the app's design-token
 * variables so they pick up the warm neutral palette.
 *
 * Every icon renders at the size the caller passes; internally each
 * uses a 24x24 viewBox with playful rounded strokes. Two-tone: the
 * outline uses currentColor (inherited from parent), the fill uses
 * a soft accent that reads as a "cartoon shadow".
 */

type Slug =
  | "plan"
  | "attractions"
  | "restaurants"
  | "hotels"
  | "flights"
  | "events"
  | "pricing"
  | "visuals";

const ACCENT = "var(--color-highlight)"; // sand/gold — cartoon shadow
const FILL_SOFT = "color-mix(in srgb, var(--color-highlight) 22%, transparent)";

interface IconProps {
  size?: number;
  className?: string;
}

function Wrap({ children, size = 32, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Calendar with a happy checkmark — day-by-day plan */
function PlanIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" fill={FILL_SOFT} />
      <path d="M3.5 9h17" />
      <path d="M8 3.5v3M16 3.5v3" />
      <circle cx="8.5" cy="13" r="0.9" fill={ACCENT} stroke="none" />
      <circle cx="12" cy="13" r="0.9" fill={ACCENT} stroke="none" />
      <path d="M14.5 16.5l1.6 1.6 3-3.4" stroke={ACCENT} strokeWidth={1.8} />
    </Wrap>
  );
}

/** Colosseum-style arches — attractions / landmarks */
function AttractionsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path d="M4 20h16" />
      <path
        d="M4 20V9c0-3.5 3.6-6 8-6s8 2.5 8 6v11"
        fill={FILL_SOFT}
      />
      <path d="M8 20v-4a2 2 0 114 0v4" />
      <path d="M14 20v-4a2 2 0 114 0v4" />
      <path d="M5.5 12h13" />
      <circle cx="12" cy="6" r="0.8" fill={ACCENT} stroke="none" />
    </Wrap>
  );
}

/** Bowl of pasta with a swirl fork — Yummy */
function RestaurantsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path
        d="M3.5 12.5h17c0 4-3.8 7-8.5 7s-8.5-3-8.5-7z"
        fill={FILL_SOFT}
      />
      <path d="M3.5 12.5h17" />
      <path
        d="M8 12.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5"
        stroke={ACCENT}
      />
      <circle cx="10" cy="10.5" r="0.7" fill={ACCENT} stroke="none" />
      <circle cx="13.5" cy="10.2" r="0.7" fill={ACCENT} stroke="none" />
      <path d="M18 5v6M17 5v3M19 5v3" />
    </Wrap>
  );
}

/** Little hotel with a heart on top — Hotels */
function HotelsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path
        d="M4 20V9l8-4.5L20 9v11z"
        fill={FILL_SOFT}
      />
      <path d="M3.5 20h17" />
      <rect x="10" y="13.5" width="4" height="6.5" fill="white" stroke="currentColor" />
      <rect x="6.5" y="11" width="2.5" height="2.5" rx="0.4" />
      <rect x="15" y="11" width="2.5" height="2.5" rx="0.4" />
      <path
        d="M12 8.5c-.7-1-2-.8-2 .3 0 1.2 2 2.4 2 2.4s2-1.2 2-2.4c0-1.1-1.3-1.3-2-.3z"
        fill={ACCENT}
        stroke={ACCENT}
      />
    </Wrap>
  );
}

/** Paper airplane with a trail — Flights */
function FlightsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path
        d="M20.5 4L3.5 10.5l6 2 2 6z"
        fill={FILL_SOFT}
      />
      <path d="M20.5 4L11.5 18.5l-2-6" />
      <path d="M20.5 4L9.5 12.5" />
      <path
        d="M4 17c1.5-.5 3-.5 4.5 0"
        stroke={ACCENT}
      />
      <path d="M6 20c1-.4 2-.4 3 0" stroke={ACCENT} />
    </Wrap>
  );
}

/** Ticket with a musical note — Events */
function EventsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path
        d="M3.5 8.5A2 2 0 015.5 6.5h13a2 2 0 012 2v1a2 2 0 100 4v1a2 2 0 01-2 2h-13a2 2 0 01-2-2v-1a2 2 0 100-4z"
        fill={FILL_SOFT}
      />
      <path d="M9.5 6.5v11" strokeDasharray="1.5 1.5" />
      <circle cx="15" cy="15" r="1.4" fill={ACCENT} stroke={ACCENT} />
      <path d="M16.4 15V10l3-.8V14" stroke={ACCENT} />
      <circle cx="17.9" cy="14" r="1.4" fill={ACCENT} stroke={ACCENT} />
    </Wrap>
  );
}

/** Stack of coins with a shine — Prices */
function PricingIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.2" fill={FILL_SOFT} />
      <path d="M5 6v3c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2V6" />
      <path d="M5 10v3c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-3" />
      <path d="M5 14v3c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-3" />
      <path
        d="M9 7.5c.5-.4 1.3-.5 2-.2"
        stroke={ACCENT}
        strokeWidth={1.4}
      />
      <circle cx="12" cy="6" r="0.6" fill={ACCENT} stroke="none" />
    </Wrap>
  );
}

/** Artist palette with sparkles — Mood / AI Visuals */
function VisualsIcon(props: IconProps) {
  return (
    <Wrap {...props}>
      <path
        d="M12 3.5c-5 0-8.5 3.4-8.5 7.3 0 3.5 2.8 5.7 5.4 5.7 1.7 0 2.1-1.3 3.1-1.3 1.6 0 1.5 3.3 4.6 3.3 2.1 0 3.9-2 3.9-5.2 0-5.5-3.5-9.8-8.5-9.8z"
        fill={FILL_SOFT}
      />
      <circle cx="8" cy="10.5" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="12" cy="8" r="1.1" fill="var(--color-danger)" stroke="none" />
      <circle cx="16" cy="10" r="1.1" fill="var(--color-primary)" stroke="none" />
      <circle cx="15" cy="14" r="1.1" fill="var(--color-accent)" stroke="none" />
      <path d="M19.5 4l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17.5 6l1.5-.5z" fill={ACCENT} stroke="none" />
    </Wrap>
  );
}

const ICONS: Record<Slug, (props: IconProps) => React.JSX.Element> = {
  plan: PlanIcon,
  attractions: AttractionsIcon,
  restaurants: RestaurantsIcon,
  hotels: HotelsIcon,
  flights: FlightsIcon,
  events: EventsIcon,
  pricing: PricingIcon,
  visuals: VisualsIcon,
};

export function CornerstoneIcon({
  slug,
  size,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  // Route slugs may carry query params (e.g. attractions?kind=restaurants) —
  // strip them before lookup. Unknown slugs render nothing.
  const key = slug.split("?")[0] as Slug;
  const Icon = ICONS[key];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}
