import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Map"
      hint="Resolving destination coordinates and nearby places…"
    />
  );
}
