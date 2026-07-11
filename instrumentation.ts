/**
 * Next.js instrumentation hook.
 *
 * Server-side secrets (GEMINI/LITEAPI/PREDICTHQ/GOOGLE_MAPS) are injected into
 * the environment at PROCESS SPAWN by `scripts/load-secrets.mjs` (wired into the
 * dev/build/start npm scripts), NOT here — importing the Google Secret Manager
 * client into the Next build graph breaks webpack (its Node-only deps: path/http/
 * grpc). So this hook is intentionally a no-op. See scripts/load-secrets.mjs.
 */
export async function register() {
  // no-op — secrets are injected before Next starts (scripts/load-secrets.mjs)
}
