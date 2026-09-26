// HomeOps - PWA skeleton (specification phase). Service worker contract only.

/**
 * Service worker (Serwist, ADR-014). Planned behaviour, in full:
 *  - precache the shell and immutable static assets only - never data;
 *  - network-first for navigations with a short timeout, falling back to the shell plus an explicit
 *    staleness banner ("Last updated 12 min ago") - cached data is never presented as live;
 *  - mutations fail loudly while offline: there is no background sync and no offline write queue,
 *    because conflict resolution is not a household's job (ADR-014);
 *  - a new worker shows "HomeOps updated - reload" instead of swapping mid-session;
 *  - versioned cache names, old caches pruned on activation.
 *
 * Owning tasks: T-PWA-002, T-PWA-003, T-PWA-004. Nothing is registered in this phase.
 */
export {};
