/**
 * Test environment defaults, imported before anything that reads configuration.
 *
 * Why this exists: `src/server/config.ts` validates the environment at boot and refuses to run without
 * a secret or a database URL. Integration tests exercise the real code paths, so they need real (but
 * throwaway) values. Nothing here is a secret and nothing here is used outside `tests/`.
 *
 * Rules honoured (TESTING.md §1.5, docs/testing/TEST-DATA.md): no network, no production value, fixed
 * and deterministic.
 */
// `process.env.NODE_ENV` is typed read-only by @types/node (Next.js marks it non-writable at runtime
// too), so the test defaults are applied through a plain record view of the same object.
const env = process.env as Record<string, string | undefined>;
env["NODE_ENV"] ??= "test";
env["BETTER_AUTH_SECRET"] ??= "integration-test-secret-0123456789abcdef";
env["DATABASE_URL"] ??= "postgres://majelishub_app:change-me@localhost:5432/majelishub_test";
env["RATE_LIMIT_STORE"] ??= "postgres";
env["RATE_LIMIT_SALT"] ??= "integration-test-rate-limit-salt";
env["APP_URL"] ??= "http://localhost:3000";

export {};
