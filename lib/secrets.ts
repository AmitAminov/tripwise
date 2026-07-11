/**
 * Server-only Google Secret Manager loader.
 *
 * Resolution order for a server-side secret:
 *   1. process.env[ENV]  — populated by .env.local in dev, or by
 *      instrumentation.ts when USE_SECRET_MANAGER=1.
 *   2. Google Secret Manager (project radiant-mason-467110-u5), fetched
 *      lazily via @google-cloud/secret-manager.
 *
 * IMPORTANT: import this ONLY from server contexts — route handlers,
 * server actions, server components, or instrumentation.ts. Never from a
 * client component: it reads process.env and talks to GCP.
 *
 * NEXT_PUBLIC_* vars are intentionally NOT handled here. They are read
 * directly and shipped to the browser exactly as before.
 *
 * SECURITY NOTE — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is exposed to the
 * browser by design and CANNOT be hidden by secret storage. Protect it
 * with an HTTP-referrer restriction + API restriction in the Google
 * Cloud console instead. The non-public GOOGLE_MAPS_API_KEY (used by
 * server-side Places/Routes/Geocoding) is treated as a server secret
 * below.
 */

const GCP_PROJECT_ID = "radiant-mason-467110-u5";

/** Server env var name -> Secret Manager secret name. */
export const SECRET_NAMES: Record<string, string> = {
  GEMINI_API_KEY: "gemini-api-key",
  LITEAPI_API_KEY: "liteapi-key",
  PREDICTHQ_API_KEY: "predicthq-key",
  GOOGLE_MAPS_API_KEY: "google-maps-api-key",
};

let client:
  | import("@google-cloud/secret-manager").SecretManagerServiceClient
  | null = null;

async function fetchFromSecretManager(
  secretName: string,
): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    throw new Error("lib/secrets.ts must not be imported from client code");
  }
  const { SecretManagerServiceClient } = await import(
    "@google-cloud/secret-manager"
  );
  client ??= new SecretManagerServiceClient();
  const name = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const data = version.payload?.data;
  return data ? Buffer.from(data).toString("utf8") : undefined;
}

/**
 * Resolve a server-side secret by its env var name (e.g. "GEMINI_API_KEY").
 * Returns the process.env value if present, otherwise fetches from Secret
 * Manager. Returns undefined for unknown names with no env value set.
 */
export async function getSecret(envName: string): Promise<string | undefined> {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  const secretName = SECRET_NAMES[envName];
  if (!secretName) return undefined;
  return fetchFromSecretManager(secretName);
}
