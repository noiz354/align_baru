/**
 * PHASE 0 — SERVICE WORKER SHELL (empty on purpose).
 * Serwist (@serwist/next) is PLANNED for VS-16 (T-OFF-002); it must not be wired before then, and
 * Turbopack integration is a known friction point recorded in docs/research/STACK-2026.md §2.2.
 *
 * Rules that the real worker will have to respect:
 *  - cache the operator app shell and the last known catalog, prices and shift state;
 *  - never cache a payment state from the network as successful (ADR-0033);
 *  - never cache location reports as anything other than local pending records;
 *  - wipe caches on logout or device revocation (ADR-0017);
 *  - a new deploy must never force-reload the app mid-shift.
 */
export const SERVICE_WORKER_NOT_IMPLEMENTED = true;
