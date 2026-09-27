/**
 * The composition root — the ONLY place all layers meet.
 *
 * Responsibility: env → infrastructure (db, storage, media, telemetry,
 * session store) → port implementations (repositories, ports) → service
 * instances (catalog, chapters, reader-progress, library, search, admin,
 * uploads, auth). Route handlers and RSC pages consume these service
 * instances; they NEVER construct infrastructure (rules D1/D6).
 *
 * Requirements: module-boundaries.md §2 (composition charter),
 * data-flow.md §7 (typed crossings), NFR-OPS-002 (typed env at boot).
 * Task: wired incrementally as each service lands (env at T-FOUND-002; first
 * service wiring at T-CATALOG-002; complete at VS-11).
 *
 * Rules:
 * - Adding a port without registering it here is a broken skeleton
 *   (typecheck enforces via the service constructors).
 * - Environment-dependent choices (e.g., telemetry on/off, storage
 *   endpoint) are decided HERE from the validated Env — nowhere else.
 * - Singletons per process; no request-scoped state lives here.
 * - `loadEnv()` is called EXACTLY ONCE per process, here, and nowhere else;
 *   it is fail-fast and redacted (DEPLOYMENT.md §4 step 1, T-FOUND-002).
 *
 * TODO(T-CATALOG-002 … T-PROD-*): buildComposition(env) → {
 *   catalog, chapters, progress, library, search, admin, uploads,
 *   auth, media, storage, telemetry, guards
 * }.
 */
import { loadEnv } from '../shared/validation';
import type { Env, EnvSource } from '../shared/validation';

/**
 * Boot entry point: validates the environment, then throws until the first
 * port is registered. The throw is the documented skeleton contract
 * (AGENTS.md §4.3), NOT a substitute for the env load — the env is validated
 * (and refused, redacted) before the throw, so a bad deploy fails here.
 *
 * Requirements: NFR-OPS-002, NFR-SEC-009. Task: T-FOUND-002.
 */
export function buildComposition(source?: EnvSource): unknown {
  const env: Env = loadEnv(source);
  // The validated env is the sole argument the per-service wiring needs; until
  // T-CATALOG-002 registers the first port there is nothing to pass it to.
  void env;
  throw new Error('Not implemented: T-CATALOG-002 (composition wiring begins)');
}
