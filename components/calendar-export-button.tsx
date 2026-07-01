"use client";

import Script from "next/script";
import { useEffect, useState, useTransition } from "react";

type ExportResult = {
  total: number;
  succeeded: number;
  failed: Array<{ title: string; error: string }>;
};

export function CalendarExportButton({ tripId }: { tripId: string }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    // Some browsers get here before Script's onLoad fires (cached script).
    if (window.google?.accounts?.oauth2) setScriptReady(true);
  }, []);

  if (!clientId) {
    return (
      <div className="text-xs text-[color:var(--color-muted)]">
        Set NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID to enable Calendar export.
      </div>
    );
  }

  function onClick() {
    setError(null);
    setResult(null);
    if (!window.google?.accounts?.oauth2) {
      setError("Google client not loaded yet — try again in a second.");
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId!,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (response) => {
        if (response.error) {
          setError(
            response.error_description ?? response.error ?? "OAuth failed",
          );
          return;
        }
        if (!response.access_token) {
          setError("No access token returned.");
          return;
        }
        startTransition(async () => {
          try {
            const res = await fetch("/api/calendar/export", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tripId,
                accessToken: response.access_token,
              }),
            });
            const body = (await res.json()) as ExportResult & {
              error?: string;
            };
            if (!res.ok || body.error) {
              setError(body.error ?? `HTTP ${res.status}`);
              return;
            }
            setResult(body);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        });
      },
    });
    tokenClient.requestAccessToken();
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div>
        <button
          onClick={onClick}
          disabled={busy || !scriptReady}
          className="btn btn-ghost text-sm"
          title="Add every itinerary item to your Google Calendar"
        >
          {busy
            ? "Exporting..."
            : !scriptReady
              ? "Loading Google..."
              : "Export to Google Calendar"}
        </button>
        {error && (
          <p className="text-xs text-[color:var(--color-danger)] mt-2">
            {error}
          </p>
        )}
        {result && (
          <p className="text-xs text-[color:var(--color-accent)] mt-2">
            Added {result.succeeded} of {result.total} events to your calendar.
            {result.failed.length > 0 && (
              <>
                {" "}
                <span className="text-[color:var(--color-danger)]">
                  {result.failed.length} failed.
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}
