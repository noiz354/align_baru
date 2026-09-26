# StrangerLink — Roadmap

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [TASKS.md](TASKS.md), [PRD.md](PRD.md)

> **The slices below are NOT executed.** This document defines the order of future
> implementation only.

---

## 0. Sequencing principle

**Text first, then safety, then media.**

The smallest future implementation proves only:

```
Anonymous Session Identity → Join Queue → Match Two Users → Text Chat
        → Disconnect → Requeue
```

Only after that is reliable do Report, Block, and Safety Enforcement get built. Only after
those are reliable does WebRTC audio/video become an implementation target.

**Video last.** It is the most expensive, the most privacy-sensitive, and the least
reliable part of the product. Building it early would be a mistake.

---

## 1. Vertical slices

### VS-0 — Foundation

**Goal:** a running, deployable, observable skeleton with no chat features.

| Deliverable |
| --- |
| Repository scaffold: Next.js 16, TypeScript strict, Tailwind v4 |
| Lint, typecheck, Vitest, Playwright wired into CI |
| `server-only` guard on `src/server/**` |
| Bundle size budgets in CI |
| OTel instrumentation hook |
| Docker images for web and realtime |
| Route shells for `/`, `/start`, `/queue`, `/chat/[sessionId]`, `/safety`, `/privacy`, `/terms`, `/settings` |
| Accessibility baseline: axe in CI, design tokens with verified contrast |

**Exit criteria:** CI green; every route renders a shell; no chat capability exists.

---

### VS-1 — Session Identity

**Goal:** a participant can exist without an account.

| Deliverable |
| --- |
| Pseudonymous participant identity, server-generated `uuidv7` |
| Client-side identity storage with graceful degradation |
| Age gate + consent with versioning (FR-ENTRY-001 … FR-ENTRY-010) |
| Consent enforcement on every chat route |
| WebSocket handshake authentication |

**Exit criteria:** a consented participant identity exists; direct navigation to
`/queue` or `/chat/[id]` without consent redirects to the gate.

---

### VS-2 — Queue

**Goal:** a participant can wait, and waiting is safe and bounded.

| Deliverable |
| --- |
| In-memory queue with single-flight claims |
| Join / cancel / expire |
| Queue join rate limiting and cooldown |
| Waiting UI with elapsed time and Cancel |
| Queue timeout with retry-or-exit |
| `ParticipantEnteredQueue` / `ParticipantLeftQueue` events |

**Exit criteria:** QA-01, QA-02, QA-24 pass. Races R2 and R9 tested.

---

### VS-3 — Text Match

**Goal:** two participants are matched into a session. **This is the first future
implementation task.**

| Deliverable |
| --- |
| Eligibility check at candidate selection |
| Atomic session creation with single-flight claims |
| Mode compatibility |
| Recent-peer avoidance |
| One-active-session invariant enforced and tested |
| Ban and block checks at selection time |
| `MatchCreated` / `SessionStarted` events |
| Races R1, R2, R3, R9, R10, R11 tested |

**Exit criteria:** QA-03, QA-07 pass. INV-1 holds under concurrency tests.

---

### VS-4 — Text Chat

**Goal:** two matched participants can exchange text.

| Deliverable |
| --- |
| Ephemeral in-memory message relay |
| Per-direction monotonic sequencing |
| Message length and rate limits |
| Inert link rendering; no attachments |
| Delivery status |
| Disconnect state differentiation (all six states) |
| Chat component shell → real implementation |
| `MessageSent` event |

**Exit criteria:** QA-04, QA-05, QA-41, QA-42, QA-43 pass.

---

### VS-5 — Disconnect + Requeue

**Goal:** leaving and rejoining is reliable and honest.

| Deliverable |
| --- |
| Skip, leave, and exit from every state |
| Post-session screen with new-match-or-exit |
| Requeue with block re-check at selection |
| Consecutive-requeue cap |
| WebSocket reconnect with a bounded window |
| Stale session rejection |
| Tab supersession |
| Races R5, R7, R8, R12 tested |

**Exit criteria:** QA-06, QA-07, QA-08, QA-27, QA-28, QA-29 pass.

---

### VS-6 — Report + Block

**Goal:** safety actions are reachable and survive disconnects.

| Deliverable |
| --- |
| Report submission with categories and optional note |
| Report accepted against terminal sessions (FR-REPORT-002) |
| Report dedup and rate limiting |
| Block creation with confirmation and persistence |
| Block enforcement at candidate selection |
| Report and block UI |
| `ReportCreated` / `BlockCreated` events |

**Exit criteria:** QA-18, QA-19, QA-20, QA-21, QA-22, QA-38 pass.

---

### VS-7 — Safety Controls

**Goal:** enforcement exists and is auditable.

| Deliverable |
| --- |
| Moderation case creation and triage ports |
| Progressive enforcement ladder |
| Temporary restrictions |
| Ban records and enforcement at every entry point |
| Ban checks fail closed |
| Immutable audit log |
| Admin surface: `/admin/moderation`, `/admin/reports`, `/admin/bans`, `/admin/metrics` |
| Appeals |

**Exit criteria:** QA-23, QA-25 pass. Every enforcement point consults the ban port.

---

### VS-8 — WebRTC Signaling

**Goal:** the signaling plane is complete and secure. **No media yet.**

| Deliverable |
| --- |
| Full signaling message contract implementation |
| Envelope validation, identity binding, recipient derivation |
| `messageId` idempotency, `sequence` monotonicity |
| Protocol violation detection and safety events |
| Realtime protocol test suite |

**Exit criteria:** T-01, T-02, T-03, T-11 mitigations verified by automated tests.

---

### VS-9 — Audio

**Goal:** optional microphone audio works.

| Deliverable |
| --- |
| `getUserMedia` with gesture-triggered permission |
| `RTCPeerConnection` lifecycle |
| Trickle ICE |
| Audio mode at match time |
| Permission-denied states |
| Mute/unmute |
| ICE restart |

**Exit criteria:** QA-10, QA-11, QA-12, QA-17 pass.

---

### VS-10 — Video

**Goal:** optional camera video works.

| Deliverable |
| --- |
| Video mode at match time |
| Camera on/off without ending the session |
| Device switching |
| Video layout with PiP and non-hiding safety controls |
| Lazy-loaded media bundle |
| Bitrate caps |

**Exit criteria:** QA-09, QA-13, QA-16, QA-35 pass.

---

### VS-11 — TURN Hardening

**Goal:** TURN is secure, quota'd, and observable.

| Deliverable |
| --- |
| coturn deployment in a dedicated segment |
| Time-limited credential minting endpoint |
| Allocation quotas and bandwidth accounting |
| Relay-destination restrictions |
| TURN metrics and alerts |
| TURN fallback verification |

**Exit criteria:** QA-14, QA-15 pass. T-05, T-06 mitigations verified.

---

### VS-12 — Moderation

**Goal:** reports are triaged and actioned by humans.

| Deliverable |
| --- |
| Moderation case queue with severity routing |
| P0 escalation with paging |
| Moderator roles and MFA |
| Moderation action and audit |
| Appeals workflow |
| Safety metrics and dashboards |
| Moderator wellbeing controls |

**Exit criteria:** QA-23 pass. P0 acknowledgement latency within target.

---

### VS-13 — Abuse Prevention

**Goal:** abuse controls are comprehensive and proportional.

| Deliverable |
| --- |
| Full server-side rate limiting |
| Cooldown ladder |
| Session and concurrency caps |
| IP-derived risk signals (hash, rate-limit only) |
| CAPTCHA where justified |
| Report credibility weighting |
| Ban-evasion detection signals |
| Abuse load tests |

**Exit criteria:** QA-24 pass. T-07, T-08, T-23, T-24, T-25 mitigations verified.

---

### VS-14 — Observability

**Goal:** the system is fully observable without being invasive.

| Deliverable |
| --- |
| All metrics in [OBSERVABILITY.md](OBSERVABILITY.md) |
| Trace propagation across services |
| Attribute and label allowlists enforced by test |
| All alerts with runbook entries |
| All dashboards |
| SLOs and error budgets |

**Exit criteria:** T-21, T-32 mitigations verified. No dashboard renders content.

---

### VS-15 — Production Hardening

**Goal:** the system is safe to run.

| Deliverable |
| --- |
| Retention job with alerting and verification tests |
| Load and stress tests |
| Security test suite complete |
| Deployment: rolling deploys, graceful drain, kill switches |
| Runbooks complete and drilled |
| On-call rotation |
| Moderator onboarding and training |
| Final privacy and safety review |

**Exit criteria:** all QA scenarios pass; all runbooks drilled; [FINAL-REVIEW](docs/architecture/FINAL-REVIEW.md) re-answered.

---

## 2. Slice dependency graph

```
VS-0 ──► VS-1 ──► VS-2 ──► VS-3 ──► VS-4 ──► VS-5 ──► VS-6 ──► VS-7
                                                              │
                                    VS-8 ──► VS-9 ──► VS-10 ──► VS-11
                                                              │
                                    VS-12 ◄────────────────────┘
                                      │
                                    VS-13 ──► VS-14 ──► VS-15
```

Safety slices (VS-6, VS-7) are deliberately placed **before** media slices (VS-8 … VS-11).
A product that can show video before it can be reported is a liability.

---

## 3. What is deliberately deferred

| Deferred | Until | Why |
| --- | --- | --- |
| Audio | VS-9 | Text must be reliable first |
| Video | VS-10 | Highest cost, highest risk |
| TURN | VS-11 | Only needed once media exists |
| Automated moderation | **Never without a new ADR** | Privacy cost |
| Device fingerprinting | **Never by default** | Privacy cost |
| Redis | Only if multi-instance realtime | Operational cost |
| Kubernetes | Only if service count justifies it | Operational cost |
| Attachments | **Never without a new ADR** | Illegal-content risk |
| Group chat | **Non-goal** | Abuse surface |

---

## 4. Definition of done per slice

A slice is done when:

1. Its functional requirements are implemented and tested.
2. Its safety requirements are implemented and tested.
3. Its QA scenarios pass.
4. Its races are tested.
5. Its metrics and alerts exist.
6. Its documentation is updated.
7. The architecture review questions remain answered.
