// HomeOps - route skeleton (specification phase). No page is implemented.

/**
 * /offline - Offline fallback
 *
 * Served by the service worker when a navigation fails offline. Explains what still works:
 * last-rendered /today is readable; every mutation requires connectivity (ADR-014, read-only offline).
 *
 * Contract: docs/design/PAGES.md. Owning task: T-PWA-003.
 * Returns null by design: no production UI exists in this phase (AGENTS.md section 1).
 */
export default function Page() {
  return null;
}
