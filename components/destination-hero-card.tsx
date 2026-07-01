import Link from "next/link";
import Image from "next/image";
import type { DestinationCard } from "@/data/destinations";
import { formatUSD } from "@/lib/format";

export function DestinationHeroCard({
  destination: d,
}: {
  destination: DestinationCard;
}) {
  const [c1, c2] = d.gradient;
  return (
    <Link
      href={`/destinations/${d.id}`}
      className="card block overflow-hidden group h-full"
    >
      <div
        className="relative aspect-[16/10]"
        style={{
          background: d.hasHero
            ? undefined
            : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        }}
      >
        {d.hasHero && (
          <Image
            src={`/destinations/${d.id}.png`}
            alt={`${d.name}, ${d.country}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="font-serif text-2xl leading-tight">{d.name}</div>
          <div className="text-sm opacity-90">
            {d.country} · {d.airport}
          </div>
        </div>
      </div>

      <div className="p-5">
        <p className="text-sm text-[color:var(--color-fg-2)] italic mb-3">
          {d.tagline}
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[color:var(--color-muted)] mb-0.5">
              Est. total, 2 pax / 7 nts
            </div>
            <div className="font-medium">
              {formatUSD(d.totalEstimate.expected)}
              <span className="text-[color:var(--color-muted)] font-normal ml-1">
                ({formatUSD(d.totalEstimate.min)} – {formatUSD(d.totalEstimate.max)})
              </span>
            </div>
            <div className="status-est mt-0.5">
              <span className="status-dot" /> Estimated
            </div>
          </div>
          <div>
            <div className="text-[color:var(--color-muted)] mb-0.5">
              Flight from TLV
            </div>
            <div className="font-medium">
              {d.flightFromTLV.directAvailable ? "Direct" : "1 stop"} ·{" "}
              {d.flightFromTLV.typicalDurationHours}h
            </div>
            <div className="text-[color:var(--color-muted)] text-[11px] mt-0.5">
              Visa:{" "}
              {d.visa.forIsraeliPassport === "visa_free"
                ? "visa-free"
                : d.visa.forIsraeliPassport.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[color:var(--color-line)] text-xs text-[color:var(--color-muted)]">
          {d.climate.seasonNote}
        </div>
      </div>
    </Link>
  );
}
