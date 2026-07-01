import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Flights"
      hint="Fetching live prices from Google Flights…"
    />
  );
}
