import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Attractions"
      hint="Searching nearby places via Google…"
    />
  );
}
