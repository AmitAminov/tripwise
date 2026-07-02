import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Events"
      hint="Fetching PredictHQ + curated for your travel window…"
    />
  );
}
