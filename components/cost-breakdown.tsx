import type { PriceEstimate } from "@/lib/types/trip-intent";
import { formatUSD } from "@/lib/format";

export function CostBreakdown({ estimates }: { estimates: PriceEstimate[] }) {
  const total = estimates.reduce((sum, e) => sum + e.expected, 0);

  return (
    <ul className="space-y-2">
      {estimates.map((e) => {
        const pct = total > 0 ? (e.expected / total) * 100 : 0;
        return (
          <li key={e.component} className="text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-[color:var(--color-fg-2)]">
                {e.component}
              </span>
              <span className="font-medium tabular-nums">
                {formatUSD(e.expected)}
              </span>
            </div>
            <div className="h-1 bg-[color:var(--color-surface-2)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background:
                    e.confidence === "high"
                      ? "var(--color-accent)"
                      : e.confidence === "medium"
                        ? "var(--color-primary)"
                        : "var(--color-highlight)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
