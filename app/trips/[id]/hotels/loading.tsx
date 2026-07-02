import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Hotels"
      hint="Fetching LiteAPI inventory + comfort-scaled estimates…"
    />
  );
}
