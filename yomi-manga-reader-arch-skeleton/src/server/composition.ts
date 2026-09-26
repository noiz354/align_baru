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
 * data-flow.md §7 (typed crossings).
 * Task: wired incrementally as each service lands (first wiring at
 * T-CATALOG-002; complete at VS-11).
 *
 * Rules:
 * - Adding a port without registering it here is a broken skeleton
 *   (typecheck enforces via the service constructors).
 * - Environment-dependent choices (e.g., telemetry on/off, storage
 *   endpoint) are decided HERE from the validated Env — nowhere else.
 * - Singletons per process; no request-scoped state lives here.
 *
 * TODO(T-FOUND-002 + per-service tasks): buildComposition(env) → {
 *   catalog, chapters, progress, library, search, admin, uploads,
 *   auth, media, storage, telemetry, guards
 * }.
 */
export function buildComposition(/* env: Env */): unknown {
  throw new Error('Not implemented: T-FOUND-002 (composition wiring begins)');
}
