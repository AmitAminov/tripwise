import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="AI Visuals"
      hint="Resolving destination context…"
    />
  );
}
