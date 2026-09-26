# ADR-0027 — PWA-first delivery; no native applications

- Status: Accepted · Date: 2026-09-26 · Deciders: Product, UX, Principal Architect
- Requirements affected: NFR-MOB-001…006, FR-REG-009, FR-CHECKIN-001 · Related: DESIGN.md §MOBILE FIRST, ADR-0022, ADR-0026

## Context

The two most demanding use cases — check-in at the entrance and recording a 2-hour session —
would both be "easier" in a native app (better camera control, background audio, reliable
storage). Native also means: two app stores, two release cycles, device fragmentation, review
delays, and an install step for every participant and volunteer.

The audience reality: participants will not install an app for one kajian; volunteers rotate
weekly and will use whatever phone they have; organizers are volunteers with a laptop.

## Decision

Ship a **mobile-first PWA** on the open web, with progressive capability:

1. **No install required** for any participant or volunteer flow. All core paths work in a
   mobile browser (`NFR-MOB-001`).
2. **Installable when wanted** (`NFR-MOB-005`): a web app manifest, offline shell for
   "my registration" and check-in code display (the participant's own QR must render offline —
   `NFR-MOB-004`), and an app icon for returning users.
3. **Capabilities degrade honestly:** camera and microphone require a secure context and a user
   gesture; where a browser cannot support a capability, the product states the alternative
   (manual check-in, phone-recorder fallback with instructions) instead of failing silently.
4. **Recording resilience designed for the browser**, not assumed away: chunked upload +
   IndexedDB queue (ADR-0008/0022) so that "the app might be killed by the OS" is survivable.
5. **PWA constraints accepted and documented:** no background recording after tab termination
   (the recorder warns, and the mitigation is chunking + screen-awake guidance); push
   notifications are limited (in-app + email are the MVP channels, `ADR-0015`); no access to
   system-level camera APIs beyond `getUserMedia`.
6. **No native shells (Capacitor/React Native) in MVP.** If a future deployment requires
   reliable background recording, the answer is a **dedicated operator station** (a small
   kiosk/laptop app or a physical recorder with file upload) — a scoped decision with its own ADR,
   not an app for everyone.

## Alternatives considered

- **React Native / Flutter app for volunteers only.** *Gains:* background audio, better camera
  control, offline storage. *Costs:* two codebases for one product, app-store cycles for hotfixes
  during kajian season, device coverage testing, and volunteers blocked from helping because the
  app is not installed. *Rejected for MVP*; revisit only if a measured failure is attributable to
  browser limitations that cash cannot fix (e.g. background recording).
- **Native participant app + web for organizers.** *Costs:* participants still will not install
  it; doubles the surface for no gain. *Rejected.*
- **Managed native wrapper of the same web app (Capacitor).** *Gains:* store presence, some
  background capability. *Costs:* store review overhead and a misleading promise of background
  recording that a WebView largely still cannot deliver reliably. *Rejected.*
- **SMS/USSD fallback for registration.** *Costs:* a paid channel, no rich content, and a
  separate flow to maintain; useful for a different problem (reach), addressable later via the
  notification adapter (`ADR-0015`). *Rejected as a delivery strategy.*
- **Progressive native: PWA now, thin native recorder later.** *Accepted shape* of the future
  path described in point 6.

## Consequences

**Positive:** one codebase and one release cadence; zero install friction for attendees;
fixes ship instantly (important for an entrance-day bug); testing is browser-based
(Playwright), which we already do; no store costs or compliance processes.

**Negative:** weaker background guarantees than native (mitigated by chunking and explicit UI
warnings); PWA push is limited and inconsistent, so email/in-app carry the load; some older
Android browsers lack features (documented minimums: Chrome 110+, Safari 17+, Firefox current —
`NFR-MOB-001`).

**Neutral:** an operator who wants maximal reliability may use a laptop-based recording station
(a supported, documented mode) rather than a phone.

## Enforcement

- No feature may require an install to complete a participant or volunteer task (review
  checklist).
- Participant pages must render the check-in code from cache with network disabled (Playwright
  test with `context.setOffline(true)`).
- Bundle budget for participant routes (≤ 1 MB initial JS, `NFR-MOB-003`) is asserted in CI.
- Any proposal to add native code must reference this ADR and include a measured, browser-
  attributable failure that cannot be mitigated on the web.

## Revisit trigger

Reopen if: field data shows ≥ 5% of recording sessions losing audio for reasons attributable to
browser backgrounding/tab termination **after** the chunking and wake-lock mitigations are
deployed — then scope a native/desktop recorder for audio operators only (not participants).
