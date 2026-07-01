import type {
  FlightOffer,
  FlightSearchQuery,
  ProviderResult,
} from "@/lib/providers/types";
import { formatDurationHours, formatCurrency } from "@/lib/format";

export function FlightOfferList({
  result,
  query,
}: {
  result: ProviderResult<FlightOffer[]>;
  query: FlightSearchQuery;
}) {
  if (result.status === "error" || !result.data) {
    return (
      <div className="card p-6">
        <div className="status-est status-error mb-2">
          <span className="status-dot" /> Provider error
        </div>
        <p className="text-sm text-[color:var(--color-fg-2)]">
          Couldn&apos;t fetch flights: {result.error ?? "unknown error"}.
        </p>
        <p className="text-xs text-[color:var(--color-muted)] mt-2">
          Make sure the fast-flights service is running:{" "}
          <code className="text-[color:var(--color-fg)]">
            cd python-services/flights && uvicorn main:app --port 8001
          </code>
        </p>
      </div>
    );
  }

  const offers = result.data;
  if (offers.length === 0) {
    return (
      <div className="card p-6 text-center text-[color:var(--color-muted)]">
        No offers found for {query.originAirport} → {query.destinationAirport}{" "}
        on {query.departDate}.
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    live_checked: "Live from Google Flights",
    estimated: "Estimated",
    cached: "Cached",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
            {offers.length} offers · {query.originAirport} →{" "}
            {query.destinationAirport}
            {query.returnDate && ` and back`}
          </div>
          <div className="text-sm text-[color:var(--color-fg-2)]">
            {query.departDate}
            {query.returnDate && ` – ${query.returnDate}`} · {query.adults}{" "}
            adult{query.adults > 1 ? "s" : ""}
          </div>
        </div>
        <div className="status-est status-live">
          <span className="status-dot" />{" "}
          {statusLabel[result.status] ?? result.status}
        </div>
      </div>

      <ul className="space-y-3">
        {offers.map((o) => (
          <li key={o.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="font-medium">{o.carriers.join(", ") || "Airline TBD"}</div>
                {o.layoverCount === 0 ? (
                  <span className="text-xs text-[color:var(--color-accent)] font-medium">
                    Direct
                  </span>
                ) : (
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {o.layoverCount} stop{o.layoverCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="text-sm text-[color:var(--color-fg-2)] mt-1">
                {o.outboundSegments[0]?.departAt ? (
                  <>
                    {o.outboundSegments[0].departAt} →{" "}
                    {o.outboundSegments[0].arriveAt}
                  </>
                ) : (
                  <>Times TBD</>
                )}
                <span className="text-[color:var(--color-muted)]">
                  {" "}
                  · {formatDurationHours(o.totalDurationMinutes / 60)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-xl text-[color:var(--color-primary)]">
                {formatCurrency(o.totalPriceUSD, o.currency)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                total · {query.adults} pax
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[color:var(--color-muted)] mt-4">
        Prices via Google Flights (scraped). Not a booking channel — click
        through to a travel site to actually book.
      </p>
    </div>
  );
}
