import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Pricing dashboard"
      hint="Aggregating flight, lodging, food, and activity estimates…"
    />
  );
}
