import { LoadingShell } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <LoadingShell
      title="Day plan"
      hint="Loading items and computing walking times…"
    />
  );
}
