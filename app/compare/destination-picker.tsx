"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CountryFlag } from "@/components/country-flag";

export interface PickerItem {
  id: string;
  name: string;
  country: string;
  /** true if this is a "{Country}-Wide" aggregate, not a specific city */
  isCountryWide: boolean;
}

/**
 * Destination picker. Groups by country; each group has a country header
 * with a flag, a "country-wide" pill (if present), and per-city checkboxes.
 * Global "Select all" / "Unselect all" toggle everything at once.
 *
 * State is mirrored into the ?ids=csv URL param via a transition so the
 * server component can re-render with the new set.
 */
export function DestinationPicker({
  items,
  initialSelected,
}: {
  items: PickerItem[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const [open, setOpen] = useState(false);

  const byCountry = useMemo(() => {
    const map = new Map<string, PickerItem[]>();
    for (const it of items) {
      const arr = map.get(it.country) ?? [];
      arr.push(it);
      map.set(it.country, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  function commit(next: Set<string>) {
    setSelected(next);
    const csv = items
      .filter((it) => next.has(it.id))
      .map((it) => it.id)
      .join(",");
    const nextParams = new URLSearchParams(params?.toString() ?? "");
    if (csv.length > 0 && next.size < items.length) {
      nextParams.set("ids", csv);
    } else {
      nextParams.delete("ids");
    }
    startTransition(() => {
      router.replace(`?${nextParams.toString()}`, { scroll: false });
    });
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit(next);
  }

  function toggleCountry(country: string, on: boolean) {
    const next = new Set(selected);
    for (const it of items) {
      if (it.country === country) {
        if (on) next.add(it.id);
        else next.delete(it.id);
      }
    }
    commit(next);
  }

  function selectAll() {
    commit(new Set(items.map((it) => it.id)));
  }
  function clearAll() {
    commit(new Set());
  }

  const total = items.length;
  const count = selected.size;

  return (
    <div className="card mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
            Destinations
          </div>
          <div className="font-serif text-lg mt-0.5">
            {count === 0
              ? "None selected"
              : count === total
                ? `All ${total} destinations`
                : `${count} of ${total} selected`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending && (
            <span className="text-xs text-[color:var(--color-muted)]">
              Updating…
            </span>
          )}
          <span
            aria-hidden
            className="text-[color:var(--color-muted)] transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[color:var(--color-line)] p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={selectAll}
              className="btn btn-ghost text-xs"
              disabled={pending || count === total}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="btn btn-ghost text-xs"
              disabled={pending || count === 0}
            >
              Unselect all
            </button>
            <span className="text-xs text-[color:var(--color-muted)] self-center ml-1">
              Tip: check a country header to select the whole country.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byCountry.map(([country, list]) => {
              const total = list.length;
              const on = list.filter((it) => selected.has(it.id)).length;
              const allOn = on === total;
              const noneOn = on === 0;
              return (
                <fieldset
                  key={country}
                  className="rounded-md border border-[color:var(--color-line)] p-3"
                >
                  <legend className="px-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-[color:var(--color-primary)]"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = !allOn && !noneOn;
                        }}
                        onChange={(e) => toggleCountry(country, e.target.checked)}
                      />
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <CountryFlag country={country} size={16} />
                        <span>{country}</span>
                      </span>
                      <span className="text-[10px] text-[color:var(--color-muted)]">
                        {on}/{total}
                      </span>
                    </label>
                  </legend>
                  <ul className="space-y-1 mt-1">
                    {list.map((it) => (
                      <li key={it.id}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-[color:var(--color-primary)]"
                            checked={selected.has(it.id)}
                            onChange={() => toggleOne(it.id)}
                          />
                          <span
                            className={
                              it.isCountryWide
                                ? "text-[color:var(--color-fg)] italic"
                                : "text-[color:var(--color-fg-2)]"
                            }
                          >
                            {it.name}
                          </span>
                          {it.isCountryWide && (
                            <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                              country
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
