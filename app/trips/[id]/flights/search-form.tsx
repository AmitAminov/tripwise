"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function FlightSearchForm({
  defaultOrigin,
  defaultDestination,
  defaultDepart,
  defaultReturn,
  defaultAdults,
  tripId,
}: {
  defaultOrigin: string;
  defaultDestination: string;
  defaultDepart: string;
  defaultReturn: string;
  defaultAdults: number;
  tripId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const q = new URLSearchParams({
      origin: String(formData.get("origin") ?? "").toUpperCase(),
      destination: String(formData.get("destination") ?? "").toUpperCase(),
      depart: String(formData.get("depart") ?? ""),
      return: String(formData.get("return") ?? ""),
      adults: String(formData.get("adults") ?? 2),
    });
    startTransition(() => {
      router.push(`/trips/${tripId}/flights?${q.toString()}`);
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-6">
      <label className="md:col-span-1">
        <span className="field-label">From</span>
        <input
          type="text"
          name="origin"
          defaultValue={defaultOrigin}
          maxLength={3}
          className="field uppercase"
          placeholder="TLV"
        />
      </label>
      <label className="md:col-span-1">
        <span className="field-label">To</span>
        <input
          type="text"
          name="destination"
          defaultValue={defaultDestination}
          maxLength={3}
          className="field uppercase"
          placeholder="PRG"
          required
        />
      </label>
      <label className="md:col-span-2">
        <span className="field-label">Depart</span>
        <input
          type="date"
          name="depart"
          defaultValue={defaultDepart}
          className="field"
          required
        />
      </label>
      <label className="md:col-span-1">
        <span className="field-label">Return</span>
        <input
          type="date"
          name="return"
          defaultValue={defaultReturn}
          className="field"
        />
      </label>
      <label className="md:col-span-1">
        <span className="field-label">Adults</span>
        <input
          type="number"
          name="adults"
          defaultValue={defaultAdults}
          min={1}
          max={10}
          className="field"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary md:col-span-6 mt-2"
      >
        {pending ? "Searching..." : "Search flights"}
      </button>
    </form>
  );
}
