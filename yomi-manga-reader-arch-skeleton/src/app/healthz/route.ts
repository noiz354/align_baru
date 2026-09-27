/**
 * Liveness endpoint (`GET /healthz`).
 *
 * Requirements: NFR-OBS-004 (liveness — process serving, NO dependency
 * checks), DEPLOYMENT.md §4/§7.
 * Task: T-FOUND-007.
 *
 * Contract: 200 { ok: true }; unauthenticated; no cache; constant < 10 ms;
 * must stay 200 when the DB is down (that is what readiness is for).
 * No information disclosure (no version strings — the deploy smoke uses
 * a separate version probe, T-PROD-006).
 *
 * ── Why this file imports nothing ────────────────────────────────────────
 * The whole point of liveness is that it cannot fail for a reason that has
 * nothing to do with this process still being able to serve. So there is no
 * database, no storage, no logger, no clock, no environment read, no import
 * at all: there is nothing here that can throw, nothing that can block, and
 * nothing that can report back what it found. `GET /readyz` is where the
 * dependency checks live (T-OBS-004), and the orchestrator is configured to
 * restart on liveness and hold traffic on readiness (DEPLOYMENT.md §7) —
 * mixing the two would restart a healthy process because its database is
 * briefly away.
 *
 * ── Why these headers ────────────────────────────────────────────────────
 * `dynamic = 'force-dynamic'` stops the App Router from statically
 * optimizing this handler at build time, which would bake the response into
 * a prerendered artifact and serve it from cache — the opposite of a probe
 * that must reflect the running process. The `Cache-Control` header states
 * the same intent to everything downstream of Next (a CDN, an intermediary
 * proxy), and `no-store` also covers the `ETag`-driven conditional path.
 *
 * The body is a module-level constant: one string, serialised once at module
 * load, so a probe is a Response allocation and a socket write.
 */

/** Never cached, never prerendered: the answer must come from the process. */
export const dynamic = 'force-dynamic';

/** The only two keys that may appear. `ok: false` is never returned here. */
const BODY = JSON.stringify({ ok: true });

export async function GET(): Promise<Response> {
  return new Response(BODY, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      // Liveness is a process signal, not a document: no sniffing, and
      // nothing to leak a route to.
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}
