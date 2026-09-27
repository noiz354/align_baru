/**
 * Response normalisation for the mounted identity handler.
 *
 * Where this belongs: `server/http`, next to the rate limiter - it is transport shaping, not identity
 * logic, and the route file must stay a thin mount (ADR-0005).
 * Specification: API.md §1 (a rate-limited request answers 429 with `Retry-After`), SECURITY.md §13.
 *
 * Why it exists: Better Auth answers its own rate-limited endpoints with a non-standard `x-retry-after`
 * header (observed on `/api/auth/sign-in/email`: `429`, `x-retry-after: 752`). Our published contract
 * promises the standard `Retry-After`, so the mount adds it instead of leaving clients to guess which
 * header this deployment happens to use. The library header is kept as well; nothing is removed.
 *
 * Failure cases: not a 429 (returned untouched) · no `x-retry-after` (untouched) · a non-numeric
 * `x-retry-after` (untouched - an invented delay would be worse than none) · `Retry-After` already
 * present (untouched).
 *
 * Task ownership: T-ORG-001 (delivered 2026-09-27).
 */

/** Adds the standard `Retry-After` header to a 429 that only carries the library's `x-retry-after`. */
export function withStandardRateLimitHeader(response: Response): Response {
  if (response.status !== 429) return response;
  if (response.headers.has("retry-after")) return response;

  const raw = response.headers.get("x-retry-after");
  if (raw === null) return response;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return response;

  const headers = new Headers(response.headers);
  headers.set("retry-after", String(seconds));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
