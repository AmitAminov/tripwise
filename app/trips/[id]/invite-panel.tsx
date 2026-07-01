"use client";

import { useState, useTransition } from "react";
import { createInvite } from "../actions";

export function InvitePanel({
  tripId,
  initialToken,
  siteUrl,
}: {
  tripId: string;
  initialToken: string | null;
  siteUrl: string;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const url = token ? `${siteUrl}/join/${token}` : null;

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const t = await createInvite(tripId);
        setToken(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create invite.");
      }
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy to clipboard — copy the link manually.");
    }
  }

  if (!url) {
    return (
      <div className="rounded-lg border border-white/10 p-4">
        <p className="text-sm text-[color:var(--color-muted)] mb-3">
          Invite your partner. They&apos;ll sign in with a magic link, then
          land on this trip automatically.
        </p>
        <button
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-[color:var(--color-accent)] text-black font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate invite link"}
        </button>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="text-sm text-[color:var(--color-muted)] mb-2">
        Share this link with your partner. Valid for 14 days.
      </div>
      <div className="flex gap-2 items-stretch">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono truncate"
        />
        <button
          onClick={copy}
          className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/5 min-w-[70px]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
