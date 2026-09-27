/**
 * Environment access — the single place configuration is read.
 *
 * Where this belongs: server/bootstrap (infrastructure). Nothing else in `src/` may read
 * `process.env` directly, because a secret that can be read anywhere can be logged anywhere.
 *
 * Specification:
 *   `.env.example` — "Every variable here is validated by the config module at boot; a missing
 *     required value must fail the boot, never a request."
 *   NFR-SEC-011 — secrets come from the environment/secret manager, never from the repository.
 *   SECURITY.md §9 — secrets never appear in logs, error messages or client bundles.
 *
 * Invariants:
 *   1. `requiredEnv` throws at module initialisation (boot), never per request.
 *   2. The thrown message names the variable and nothing else — never its value.
 *
 * Task ownership: T-ORG-001 (introduced for the auth configuration).
 */

/** Reads a variable that the application cannot start without. Throws during boot. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimmed;
}

/** Reads a variable with a safe default. Used only where absence is a supported configuration. */
export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

/**
 * Reads a positive integer, refusing anything that is not one.
 * Malformed configuration fails the boot rather than silently falling back to a default that
 * nobody reviewed.
 */
export function requiredIntEnv(name: string, fallback?: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}
