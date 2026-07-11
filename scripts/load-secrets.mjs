/**
 * Spawn-time secret loader for Next.js.
 *
 * Fetches the server-side secrets from Google Secret Manager and injects them
 * into the environment BEFORE launching `next` (dev/build/start), so every Next
 * worker inherits them via process.env — and the Secret Manager client never
 * enters the webpack bundle (which chokes on its Node-only deps: path/http/grpc).
 *
 * Usage (wired into package.json):  node scripts/load-secrets.mjs next dev
 *
 * Precedence: a value already in the environment (or .env.local) WINS — this only
 * fills what's missing. Requires ADC (`gcloud auth application-default login`) or a
 * service account with secretmanager.secretAccessor. Never prints secret values.
 */
import { spawn } from "node:child_process";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const PROJECT = process.env.GCP_PROJECT || "radiant-mason-467110-u5";

/** Server env var -> Secret Manager secret name. NEXT_PUBLIC_* are NOT here. */
const MAP = {
  GEMINI_API_KEY: "gemini-api-key",
  LITEAPI_API_KEY: "liteapi-key",
  PREDICTHQ_API_KEY: "predicthq-key",
  GOOGLE_MAPS_API_KEY: "google-maps-api-key",
};

const env = { ...process.env };
const client = new SecretManagerServiceClient();
let loaded = 0;
for (const [envName, secret] of Object.entries(MAP)) {
  if (env[envName]) continue; // real env / .env.local wins
  try {
    const [v] = await client.accessSecretVersion({
      name: `projects/${PROJECT}/secrets/${secret}/versions/latest`,
    });
    const val = v.payload?.data?.toString("utf8");
    if (val) {
      env[envName] = val;
      loaded += 1;
    }
  } catch (e) {
    console.error(`[load-secrets] WARN could not load ${secret}: ${e.message}`);
  }
}
console.error(`[load-secrets] injected ${loaded} secret(s) from Secret Manager (${PROJECT})`);

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/load-secrets.mjs <command> [args...]");
  process.exit(1);
}
const child = spawn(cmd, args, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
