import { Header } from "@/components/header";

/**
 * Shared shell for route-level `loading.tsx` files.
 * Renders the same header + a soft skeleton so route transitions
 * don't flash blank content while server components are streaming.
 */
export function LoadingShell({
  title,
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-2">
            {title ?? "Loading"}
          </div>
          <div className="h-8 bg-[color:var(--color-surface-2)] rounded-md w-72 animate-pulse" />
          {hint && (
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              {hint}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="card p-4 animate-pulse">
            <div className="h-4 bg-[color:var(--color-surface-2)] rounded w-48 mb-2" />
            <div className="h-3 bg-[color:var(--color-surface-2)] rounded w-64" />
          </div>
          <div className="card p-4 animate-pulse">
            <div className="h-4 bg-[color:var(--color-surface-2)] rounded w-56 mb-2" />
            <div className="h-3 bg-[color:var(--color-surface-2)] rounded w-72" />
          </div>
          <div className="card p-4 animate-pulse">
            <div className="h-4 bg-[color:var(--color-surface-2)] rounded w-40 mb-2" />
            <div className="h-3 bg-[color:var(--color-surface-2)] rounded w-60" />
          </div>
        </div>
      </main>
    </>
  );
}
