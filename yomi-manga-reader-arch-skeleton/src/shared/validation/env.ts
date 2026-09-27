/**
 * Environment configuration contract.
 *
 * Authority: DEPLOYMENT.md §3 (normative variable inventory), NFR-OPS-002.
 * Requirements: NFR-OPS-002, NFR-SEC-009, NFR-OBS-006 (redaction).
 * Task: T-FOUND-002 (implementation — Zod schema + `loadEnv()`).
 *
 * Rules the implementation MUST follow:
 * - Zod schema covering EVERY variable in DEPLOYMENT.md §3 (required vs
 *   optional exactly as the table states).
 * - Fail fast: invalid/missing ⇒ refuse to boot with a message that names
 *   the VARIABLE (never its value) — NFR-OBS-006.
 * - `APP_ORIGIN` is parsed (URL) and frozen; non-HTTPS origins are rejected
 *   when NODE_ENV=production.
 * - Extra unknown variables: warn, do not fail.
 * - Per-environment defaults only for non-secret items (limits etc.).
 *
 * Zod is PLANNED (zod 4.x, research registry SELECTED) and NOT installed
 * during the architecture phase — this file defines the shape contract
 * without importing it (the implementation at T-FOUND-002 adds the
 * `loadEnv()` validator; this interface becomes its return type).
 */

/**
 * The validated, frozen environment object every module may consume.
 *
 * Field semantics per DEPLOYMENT.md §3 (one line each, non-normative summary):
 * - nodeEnv: 'development' | 'test' | 'production'
 * - appOrigin: URL (CSRF origin check, CSP, cookies — NFR-SEC-004/011)
 * - sessionSecret: 256-bit secret (NEVER logged — redaction contract)
 * - databaseUrl: PostgreSQL DSN (server/db only consumes)
 * - storage: { endpoint, region, bucket, accessKeyId, secretAccessKey } —
 *   all secrets redacted in any log path (T-13)
 * - uploadLimits: { maxTotalBytes, maxFileBytes, maxFiles } — defaults per
 *   NFR-SEC-007; sane-range validated (T-UPLOAD-012)
 * - otel: { endpoint?, serviceName? } — empty endpoint = telemetry off
 * - mail: { from?, host?, port?, user?, pass? } — required from VS-9
 * - rateLimits: per NFR-SEC-005/006 (override table)
 *
 * TODO(T-FOUND-002): `loadEnv(input: Record<string, string | undefined>)`
 * returning a frozen `Env`, or throwing a redacted ConfigurationError.
 * Do not implement in the architecture phase.
 */
// The interface is intentionally a documented placeholder: its fields are
// specified by the Zod schema at T-FOUND-002 (single source: DEPLOYMENT.md
// §3), which is not installed in the architecture phase. Dependent
// skeletons reference `Env` by name only (no field access), so the empty
// body is sufficient for typechecking and documents the crossing.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate placeholder, see above
export interface Env {}
