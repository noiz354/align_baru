# ADR-014: PWA Strategy — Installable Shell, Honest Staleness, No Full Offline Sync

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps is used in the kitchen, in the bathroom, and near the bin — often with one hand and sometimes with poor connectivity (basement, outdoor bin area). Members will install it on a phone home screen if it feels like an app. Push notifications (FR-PWA-003) are a core part of the product's value (reminders that work without opening anything). iOS has supported Web Push for home-screen-installed PWAs since 16.4, but background sync is still limited and storage budgets are tighter than on Android. A full offline-first architecture (local database, conflict resolution, sync engine) is a large, error-prone commitment — and for a household app, the dangerous failure mode is *acting on stale data* ("trash already collected" showing as full, or a chore completed by a partner still showing as due).

## Problem
What level of offline capability and caching should the PWA provide, so that it feels app-like and survives bad networks, without either (a) inventing a sync engine we cannot maintain or (b) presenting stale household state as current?

## Decision Drivers
- Installability and app-like feel (FR-PWA-001).
- Push support on installed iOS and Android (FR-PWA-003).
- Never show stale state as truth (DP-2/DP-12, DESIGN §11 E-6).
- No sync engine, no local writes, no conflict resolution in v1 (PRD NG-9).
- Simple to operate: one service worker, cache-busting correctness, no zombie caches.
- Fast repeat loads for a mostly-read mobile app (NFR-PERF-006).

## Options Considered
1. **Installable shell + static/asset caching + read-only offline shell with explicit staleness; mutations always require connectivity (fail loudly, retryable).**
2. **Full offline-first with local persistence and background sync** — best perceived offline UX; requires a sync engine, conflict rules, and per-platform background constraints; disproportionate for a 3–10 person app.
3. **No service worker at all** (plain responsive web) — simplest; loses install prompt, push, and fast repeat loads.
4. **Cache-everything with stale-while-revalidate on data** — fast, but risks showing stale household state; contradicts DP-2.
5. **Native wrapper (Capacitor/TWA)** — better push on iOS; adds a build pipeline and app-store distribution for one small product; rejected alongside NG-8.

## Decision
Adopt **(1)**, with these concrete rules:

- **Manifest**: name, short name, `display: standalone`, theme/background colours from design tokens, maskable icons, `start_url: /today`, `scope: /`. Install prompt offered only after meaningful engagement (second session), never on first load (DESIGN §12).
- **Service worker** (`@serwist/next`, adopted at VS-13): precache the app shell and static assets; **network-first for navigations and data**; cache-first only for immutable static assets.
- **No caching of household data responses as "current"**: any cached `/today` HTML/data is rendered with a visible staleness banner ("Last updated 2 h ago — tap to refresh") and is never used to justify an action.
- **Mutations require connectivity**: actions fail with a clear, retryable error (E-1) instead of queueing silently. No background sync in v1 (FR-PWA-004).
- **Offline fallback page** explains what is unavailable and offers a retry.
- **Update flow**: new service worker activates with `skipWaiting` + `clientsClaim`, and the UI surfaces "Updated — reload" rather than silently swapping behaviour mid-session. Cache names are versioned per build to avoid zombie caches.
- **Push**: VAPID-based Web Push; subscription stored per device; permission requested only from `/settings/notifications` after an explicit toggle (DESIGN §12), never on load.
- **iOS specifics**: document the "Share → Add to Home Screen" path in settings, since iOS has no automatic install prompt and push requires the installed PWA.
- **Storage hygiene**: subscriptions pruned on 410/404; caches pruned on activation.

## Consequences

### Positive
- Genuinely app-like on a phone without a sync engine, a local database, or conflict resolution.
- Repeat loads are fast because the shell and assets are cached.
- Push works on both major platforms, which is what makes reminders effective.
- Staleness is explicit, so members never act on wrong information — the honest alternative to fake offline support.
- Small, auditable surface: one service worker file, one manifest, one registration point.

### Negative
- No offline *actions*: a member with no signal cannot mark a chore done (they will retry later — an acceptable trade for correctness).
- Cached shells can go stale in confusing ways if versioning is mishandled (mitigated by versioned caches + update prompt).
- iOS install friction (manual Add to Home Screen) reduces push adoption.
- Requires bundler-compatible tooling (Serwist) — a dependency that must track Next.js majors.

## Risks
| Risk | Impact |
| --- | --- |
| Zombie service worker serving old HTML | Broken/confusing UI |
| Stale data treated as current | Wrong actions |
| Push permission requested too early → permanently denied | Feature unusable |
| Cache growth on mobile storage | Install shedding |
| iOS background limits | Delayed notifications |

## Mitigations
- Versioned caches and activation-time pruning; the "Updated — reload" affordance (documented in docs/design/INTERACTION-PATTERNS.md).
- The staleness banner is a required part of the offline contract, tested in `tests/e2e/qa-14-pwa-install-offline-and-staleness.spec.ts` (skeleton).
- Permission UX is gated behind an explicit settings toggle with rationale copy; a "why" explanation precedes the browser prompt.
- Precache list is bounded (shell + icons + fonts); data responses are never precached.
- Expectations for iOS are documented so a delayed notification is not treated as a product bug (OPERATIONS.md#known-limitations).

## Revisit Conditions
- Members are genuinely offline often (e.g. unreliable home internet) → reconsider a queued-mutation design with explicit conflict rules (would need a new ADR).
- Required capability is blocked by iOS PWA limits and install rates are high → reconsider a thin native wrapper.
- Serwist compatibility with a Next.js major lags badly → fall back to a hand-written service worker (documented escape hatch).

## References
- PRD.md — FR-PWA-001..004, NG-8, NG-9, NFR-PERF-006
- DESIGN.md — §10 loading, §11 errors, §12 mobile behaviour
- docs/research/STACK-2026.md#9 (Serwist vs next-pwa)
- docs/research/PWA-AND-PUSH-2026.md
- ADR-001 (framework), ADR-009 (delivery)
- TASKS.md — T-PWA-001..006
