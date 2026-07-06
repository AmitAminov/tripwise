import { iso2ForCountry } from "@/lib/country-flags";

/**
 * Country flag rendered as a small <img> from flagcdn.com.
 * We use an <img> instead of an emoji because Windows Chrome / Edge / Firefox
 * do not render regional-indicator emoji as flags — they show the ISO letters
 * instead. flagcdn gives a consistent visual across every browser + OS.
 */
export function CountryFlag({
  country,
  size = 18,
  className,
}: {
  country: string;
  size?: number;
  className?: string;
}) {
  const iso = iso2ForCountry(country).toLowerCase();
  if (!iso) return null;
  const height = Math.round(size * 0.75);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${iso}.svg`}
      alt=""
      width={size}
      height={height}
      loading="lazy"
      decoding="async"
      className={`inline-block rounded-sm shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)] ${className ?? ""}`}
    />
  );
}
