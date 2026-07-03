"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  PICKABLE_KINDS,
  KIND_LABEL,
  KIND_DOT,
  type PickableKind,
} from "./kinds";

export function KindsPicker({ initial }: { initial: PickableKind[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle(k: PickableKind) {
    const current = new Set(initial);
    if (current.has(k)) current.delete(k);
    else current.add(k);
    if (current.size === 0) current.add("attractions");

    const next = new URLSearchParams(params?.toString() ?? "");
    next.set(
      "kinds",
      [...PICKABLE_KINDS].filter((x) => current.has(x)).join(","),
    );

    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className="flex flex-wrap gap-2 items-center mb-4"
      aria-label="Fetch categories from Google Places"
    >
      <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mr-1">
        Fetch:
      </span>
      {PICKABLE_KINDS.map((k) => {
        const selected = initial.includes(k);
        return (
          <button
            key={k}
            onClick={() => toggle(k)}
            disabled={pending}
            className="chip"
            data-selected={selected}
            aria-pressed={selected}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ background: KIND_DOT[k] }}
            />
            {KIND_LABEL[k]}
          </button>
        );
      })}
      {pending && (
        <span className="text-xs text-[color:var(--color-muted)]">
          Refreshing…
        </span>
      )}
    </div>
  );
}
