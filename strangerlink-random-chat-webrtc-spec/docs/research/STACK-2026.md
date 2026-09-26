# Stack Validation — 2026

- **Status:** Complete
- **Date of research:** 2026-09-26
- **Method:** Official sources and current release trackers checked on the research date.
  Versions below are the *stable lines* identified on that date. Exact patch numbers
  drift; the **line** is what this document commits to.
- **Rule applied:** "Do not choose a package only because it is newer." Stability,
  maintenance, production track record, and operability outrank novelty.

Classification legend:

| Class | Meaning |
| --- | --- |
| **SELECTED** | Committed for this product. Default choice. |
| **PLANNED** | Accepted as a future addition once a vertical slice needs it. Not built now. |
| **OPTIONAL** | Available if a specific need arises. Requires an ADR to adopt. |
| **REJECTED** | Considered and deliberately not adopted, with reasons. |

---

## 1. Runtime

### Node.js — **SELECTED: Node.js 24 LTS ("Krypton")**

| Finding | Detail |
| --- | --- |
| Status on research date | Node 24 is **Active LTS**; Node 22 is Maintenance LTS; Node 26 is Current |
| Key dates | Node 24 maintenance begins 2026-10-20; EOL 2028-04-30. Node 26 becomes Active LTS 2026-10-28, EOL 2029-04-30 |
| Node 20 / 18 | **End of life** — Node 20 EOL 2026-04-30, Node 18 EOL 2025-04-30 |

**Decision:** Pin the runtime to **Node.js 24 LTS**.

**Rationale:** Active LTS gives roughly 12 more months of full feature backports than
the maintenance line, with an EOL runway to 2028. Node 26 becomes Active LTS on
2026-10-28 — within weeks of this document — so we record an explicit **revisit
condition**: when Node 26 reaches Active LTS, re-evaluate for the next major upgrade
cycle rather than migrating mid-slice.

**Rejected:** Node 22 (maintenance-only, EOL 2027-04-30 — too short a runway for a
greenfield project), Node 26 at time of writing (Current line, not yet LTS), Node 20
(EOL, unpatched).

### TypeScript — **SELECTED: TypeScript 6.x stable, `strict: true`**

TypeScript 6.0 reached stable in 2026 (6.0.2 stable, 6.0.3 current patch line).
`strict` mode is mandatory and `noUncheckedIndexedAccess` is enabled.

**Rationale:** The signaling and session contracts in this product are highly
type-sensitive; a protocol bug is a safety bug. Strict mode is non-negotiable for this
codebase. TS 6 is a stable line, not a beta.

**Rejected:** `strict: false` (unacceptable for protocol code), staying on TS 5.x
(misses the stable 6 line with no benefit).

---

## 2. Web framework and UI

### Next.js — **SELECTED: Next.js 16.x stable (App Router)**

| Finding | Detail |
| --- | --- |
| Current stable line | Next.js 16.x (16.2.x patch line) |
| React | React 19.x |
| Notable 16 changes | Turbopack default for dev + build; Cache Components (`use cache`); **async-only request APIs** (sync `cookies()`/`headers()` removed); Node.js 20+ required |
| Security | May 2026 coordinated release fixed 13 advisories incl. **middleware/proxy auth bypass** via App Router segment-prefetch and Pages Router i18n default-locale paths. Patched in 16.2.6 |

**Decision:** Next.js 16 App Router.

**Rationale:** Production-proven, huge ecosystem, first-class support for the
route-shell model this architecture uses, and a well-defined server/client boundary
that we need for keeping moderation logic server-side.

**Consequence we accept and design around:** the May 2026 advisory class
("authorization bypass via middleware/proxy") means **authorization must not live in
middleware alone**. Every route handler and server action re-checks authorization
server-side. This is already NFR-SEC-001.

**Rejected:** Remix/React Router 7 (smaller ecosystem for this team's hiring pool),
SvelteKit (excellent, but smaller realtime/WebRTC ecosystem), Vite + plain React SPA
(loses server-side rendering for the entry funnel and the security boundary).

### React — **SELECTED: React 19.x stable**

Comes with Next.js 16. React Compiler is **PLANNED** (experimental) — not enabled in
this phase.

### Tailwind CSS — **SELECTED: Tailwind CSS v4 (4.3.x line)**

| Finding | Detail |
| --- | --- |
| Stable since | v4.0.0, 2025-01-22 |
| Current line | 4.3.x (4.3.3 as of 2026-07-16) |
| Engine | Rust-based Oxide engine; CSS-first configuration via `@theme`; no `tailwind.config.js` required |
| Browser floor | Safari 16.4+, Chrome 111+, Firefox 128+ |
| v3 line | Maintained on `v3-lts` tag only |

**Decision:** Tailwind v4.

**Rationale:** Fast builds, CSS-first config, and full framework support. The browser
floor (Safari 16.4+) is acceptable for a mobile-first web product in 2026 and is
recorded as a constraint.

**Rejected:** Tailwind v3 (no reason to start a new project on it in 2026),
CSS-in-JS runtime libraries (runtime cost, worse for the JS budget in
PERFORMANCE.md), vanilla CSS (slower to build a responsive, accessible design system).

---

## 3. Data

### PostgreSQL — **SELECTED: PostgreSQL 18**

| Finding | Detail |
| --- | --- |
| Released | 2025-09-25 |
| Relevant features | Async I/O subsystem (`io_method`, io_uring on Linux), native `uuidv7()`, virtual generated columns, `RETURNING` old/new aliases, OAuth 2.0 auth, SCRAM (md5 auth deprecated), skip scans |
| Managed availability | RDS and other managed providers support 18 |

**Decision:** PostgreSQL 18 for durable state.

**Rationale:** The only durable stores this product needs are safety records: reports,
bans, moderation audit, session metadata. `uuidv7()` gives us unguessable,
time-ordered, index-friendly identifiers — which matters for both NFR-SEC-003
(unguessable session IDs) and index locality. The async I/O subsystem is a real
operational win for a write-heavy audit trail.

**Rejected:** MySQL/MariaDB (weaker JSON and constraint ergonomics), MongoDB (we need
relational integrity for bans/blocks/reports), SQLite (insufficient for concurrent
multi-instance writes), DynamoDB (operationally heavier for this data shape).

### Redis — **PLANNED (conditional), not SELECTED**

Redis is **not** in the initial stack. It becomes justified **only** if one of these
becomes true:

1. The signaling/realtime layer runs **more than one instance** and needs cross-instance
   routing or pub/sub.
2. Rate limiting must be shared across instances (a fixed-window or token-bucket in
   PostgreSQL is viable at MVP scale but adds write amplification).
3. Queue state must survive a realtime-instance restart.

**Rationale for deferring:** adding Redis adds an operational dependency, a failure
mode, and a consistency story that a single-instance MVP does not need. The FINAL-REVIEW
question "Is Redis actually necessary?" is answered **no, not yet** — see
[docs/architecture/FINAL-REVIEW.md](docs/architecture/FINAL-REVIEW.md).

**Rejected:** adopting Redis "for scale" before the scale exists.

### Message broker (Kafka / NATS / RabbitMQ) — **REJECTED for this phase**

[EVENTS.md](EVENTS.md) defines domain events **conceptually**. Introducing a broker
adds an operational dependency and a delivery-semantics problem for zero benefit at
this scale. In-process event dispatch plus durable rows in PostgreSQL is sufficient.
Revisit only if event volume or fan-out genuinely requires it.

---

## 4. Realtime transport

### `ws` — **SELECTED**

| Finding | Detail |
| --- | --- |
| Nature | Minimal, RFC 6455-compliant WebSocket implementation for Node.js; the de facto standard (~80M weekly downloads) |
| Performance | Roughly 3–5× faster raw throughput than Socket.IO; p99 ~5 ms in comparative benchmarks |
| What it does not do | No rooms, no auto-reconnect, no HTTP fallback — all explicit |

**Decision:** `ws` as the WebSocket server library.

**Rationale:** We own both ends of the protocol and we are defining a strict message
contract ([SIGNALING.md](SIGNALING.md)) that we want to validate with Zod. Socket.IO's
framing, namespacing, and long-polling fallback are overhead we do not want on a
signaling plane where we need precise control over message size limits, rate limits,
and authorization. Auto-reconnect is ~50 lines of explicit client code we would rather
own than inherit as a black box.

**Consequence we accept:** we implement reconnection, backoff, and heartbeat ourselves,
and we test them explicitly (see [TESTING.md](TESTING.md) and
[docs/realtime/FAILURE-MODEL.md](docs/realtime/FAILURE-MODEL.md)).

**Security configuration committed:** `maxPayload` cap (signaling frames are small —
64 KiB is generous), TLS only (`wss://`), origin allowlist, heartbeat with
`terminate()` for zombie sockets, and **authentication at the HTTP upgrade handshake,
not on the first message**.

### Socket.IO — **REJECTED**

Considered for its rooms, namespaces, acks, auto-reconnect, and Redis adapter. Rejected
because: custom protocol framing complicates the strict signaling contract; ~45 KB
gzipped client bundle against our PERFORMANCE.md JS budget; the fallback transport is
unnecessary for a modern mobile-first web product; and inheriting a reconnection black
box makes the failure model harder to reason about. **Revisit if** we need to support
corporate networks that block WebSocket upgrades.

### uWebSockets.js — **OPTIONAL**

Highest throughput and lowest per-connection memory in comparative benchmarks (~10×
`ws` connections). Rejected for now because the C++ native binding complicates builds,
Docker images, and CI for a benefit we do not need at MVP concurrency. Revisit only if
connection count becomes the binding constraint, and only with a load-test
justification.

### Managed realtime (Ably / Pusher) — **REJECTED**

Removes infrastructure but puts the signaling plane — the most security-sensitive
component in this system — behind a third party, and makes session-scoped authorization
harder to reason about. Also a per-connection cost that scales badly for a product whose
core loop is "connect two strangers".

---

## 5. WebRTC

### Browser WebRTC APIs — **SELECTED (standard platform APIs)**

`navigator.mediaDevices.getUserMedia`, `RTCPeerConnection`, `RTCSessionDescription`,
`RTCIceCandidate`, `RTCRtpSender.replaceTrack` / `getSenders` for device switching,
`oniceconnectionstatechange`, `restartIce()`. No WebRTC library is adopted.

**Rationale:** These are the platform. A wrapper adds bundle size and hides the state
machine we need to reason about for the failure model. Full detail in
[WEBRTC.md](WEBRTC.md).

### STUN — **SELECTED**

Public STUN servers are acceptable for **ICE candidate gathering only**. They see the
client's public IP:port mapping but do not relay media.

### coturn — **SELECTED (for TURN)**

| Finding | Detail |
| --- | --- |
| Status | The standard open-source TURN/STUN server; actively maintained; production-proven at scale |
| Minimum recommended | ≥ 4.5.0.8 (earlier versions have an IPv6 UDP socket leak that eventually exhausts file descriptors) |
| WebRTC requirements | Long-term credentials (`--lt-cred-mech`) with a realm; WebRTC does not work with anonymous access. Fingerprints (`-f`) expected. Shared secret for REST/time-limited credentials. |
| Ports | UDP/TCP 3478, TURNS 5349, relay range (default 49152–65535). 443/80 alternates for restrictive firewalls. |
| Hardening | `no-multicast-peers`, `no-stun-backward-compatibility`, `response-origin-only-with-rfc5780`, `stale-nonce`, disable RFC 5780/3489 legacy, restrict relay to public ranges, `user-quota`/`total-quota` |

**Decision:** coturn, deployed in a **dedicated network segment** with no access to
application servers or databases, using **time-limited REST credentials** (never static
username/password), and with quotas.

Full decision and trade-offs: [ADR-006](docs/adr/ADR-006-turn-strategy.md). IP-exposure
implications: [ADR-014](docs/adr/ADR-014-anonymity-model.md) and [PRIVACY.md](PRIVACY.md).

### Managed TURN — **OPTIONAL**

Metered/Cloudflare Calls-style managed TURN is a legitimate option if operating coturn
becomes a burden. It moves a bandwidth-cost and operational problem to a vendor. Recorded
as OPTIONAL, not SELECTED, because we want control over credential lifetime and relay
destination policy at launch.

### SFU / MCU — **REJECTED**

Not needed for a two-party session. An SFU is a large operational and architectural
commitment that only pays off with 3+ participants, which this product explicitly does
not have (NG-9).

---

## 6. Validation

### Zod — **SELECTED: Zod 4.x**

Zod 4 is stable (4.6.x current), tested against TypeScript 5.5+, with significantly
better performance and lower TS compile times than v3, plus a `Zod Mini` variant for
smaller bundles.

**Decision:** Zod 4 for all boundary validation — API inputs, WebSocket/signaling
messages, and environment configuration.

**Rationale:** We need schema validation at every untrusted boundary, and we want the
TypeScript type and the runtime validator to be the *same* artifact so they cannot
drift. Zod 4 gives us that with static inference.

**Rejected:** hand-rolled validators (drift risk), Valibot (fine, smaller ecosystem),
io-ts (worse DX), Yup (less ergonomic inference).

---

## 7. Observability

### OpenTelemetry — **SELECTED**

OpenTelemetry is the vendor-neutral standard with active, frequent releases across all
language SDKs.

**Decision:** OpenTelemetry SDK for traces and metrics, OTLP export, with a vendor
backend. Next.js `instrumentation.js` (stable since Next 15) is the server-side hook.

**Constraint committed:** spans and metrics carry **identifiers and durations only**.
No message content, no IP addresses, no chat text. See
[OBSERVABILITY.md](OBSERVABILITY.md).

**Rejected:** vendor-proprietary agents (lock-in), no tracing at all (we need to debug
signaling races).

---

## 8. Testing

### Vitest — **SELECTED: Vitest 5.x**

Vitest 5.0 shipped 2026-09-03, focused on performance and long-standing bug fixes.
Vite-native, Jest-compatible API, first-class browser mode.

**Decision:** Vitest for unit and integration tests, including the `describe.todo`
skeletons in this repository.

### Playwright — **SELECTED**

Playwright is the standard for cross-browser E2E, and is the browser provider for Vitest
browser mode.

**Decision:** Playwright for E2E and for browser-level WebRTC/permission tests
(`--use-fake-device-for-media-stream` is the mechanism that makes camera/mic-denied
scenarios testable without real hardware).

**Rejected:** Cypress (weaker multi-browser and WebRTC support), Selenium (legacy).

### Load testing — **PLANNED**

A WebSocket load test is required before VS-15. Tool selection (k6 / Artillery /
custom `ws` client) is deferred to the load-testing task; the *requirement* is recorded
now in [TESTING.md](TESTING.md).

---

## 9. Packaging and CI

### Docker — **SELECTED**

Multi-stage builds, distroless or slim base images, non-root user, one image per
service. coturn runs as a separate container with its own network segment.

### GitHub Actions — **SELECTED**

Standard CI: typecheck → lint → unit → integration → build → Playwright → dependency
audit. Cached `node_modules` and Playwright browsers. `npm audit` / Dependabot with a
documented triage policy in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 10. Rejected / deferred summary

| Technology | Class | Reason |
| --- | --- | --- |
| Node.js 22 | REJECTED | Maintenance-only, EOL 2027-04-30 |
| Node.js 26 (as of 2026-09-26) | PLANNED | Current line; Active LTS from 2026-10-28 |
| Node.js 20 / 18 | REJECTED | End of life, unpatched |
| Next.js 15 | REJECTED | 16 is the current stable line |
| Remix / SvelteKit | REJECTED | Smaller realtime + hiring ecosystem for this team |
| Tailwind v3 | REJECTED | No reason to start new work on it in 2026 |
| CSS-in-JS | REJECTED | Runtime cost against the JS budget |
| Socket.IO | REJECTED | Protocol overhead on a strict signaling contract |
| uWebSockets.js | OPTIONAL | Native build complexity; revisit on load evidence |
| Managed realtime (Ably/Pusher) | REJECTED | Third-party control of the signaling plane |
| Redis | PLANNED (conditional) | Not needed until multi-instance realtime |
| Kafka / NATS / RabbitMQ | REJECTED | No justification at this scale |
| MongoDB | REJECTED | Relational integrity required for bans/reports |
| SFU / MCU | REJECTED | Two-party product only |
| Managed TURN | OPTIONAL | Control vs. operations trade-off |
| Automated moderation model | PLANNED | Not in this phase (FR-MOD-006) |
| Age assurance vendor | PLANNED | Cost/friction vs. self-attestation trade-off |
| React Compiler | PLANNED | Experimental |

---

## 11. Locked stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 24 LTS |
| Language | TypeScript 6.x, `strict: true`, `noUncheckedIndexedAccess` |
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Database | PostgreSQL 18 |
| Validation | Zod 4 |
| Realtime transport | `ws` (WebSocket, TLS only) |
| Media | Browser WebRTC APIs + STUN + coturn (time-limited credentials) |
| Observability | OpenTelemetry (OTLP) |
| Unit/integration tests | Vitest 5 |
| E2E / browser tests | Playwright |
| Packaging | Docker (multi-stage, non-root) |
| CI | GitHub Actions |

---

## 12. References

- Node.js release schedule and EOL dates — https://github.com/nodejs/release
- Next.js releases and the May 2026 security release — https://nextjs.org/blog, https://vercel.com/changelog/next-js-may-2026-security-release
- PostgreSQL 18 release announcement — https://www.postgresql.org/about/news/postgresql-18-released-3142/
- Tailwind CSS v4 — https://tailwindcss.com/
- Zod 4 — https://zod.dev/
- coturn documentation and `turnserver` flags — https://github.com/coturn/coturn
- `ws` — https://github.com/websockets/ws
- Vitest — https://vitest.dev/
- Playwright — https://playwright.dev/
- OpenTelemetry — https://opentelemetry.io/
- TURN security best practices — https://www.enablesecurity.com/blog/turn-security-best-practices/
