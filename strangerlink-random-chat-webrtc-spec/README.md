# StrangerLink

> **Random stranger chat — architecture, design, and skeleton only.**
> This repository contains **no working random-chat features**. No matchmaking, no
> signaling server, no WebRTC negotiation, no persistence, no moderation logic.

Working name. The product name may change.

---

## What this repository is

This is the **documentation + architecture + design + skeleton code** phase of a
greenfield random stranger chat web application inspired by the interaction model of
Omegle.

It is explicitly **not** a production application. Every function that would require
business logic, network logic, matchmaking logic, moderation logic, or persistence is
declared as a port and left unimplemented.

### Phase definition (hard rule)

The following are **forbidden** in this phase and **must not** be added without a
completed vertical slice in a later phase:

| Forbidden | Status in this repo |
| --- | --- |
| Real matchmaking | Port only (`MatchmakingService`) |
| Production WebRTC | Port only (`PeerConnectionCoordinator`) |
| Working signaling | Message contracts only |
| Real WebSocket infrastructure | Transport port only |
| Real TURN/STUN integration | Documented in ADR-006, no code |
| Moderation model integration | Policy + ports only |
| Functional authentication | Port only |
| Persistent bans | Data model documented, no persistence |
| Real database queries | Repository ports only, no migrations |
| Real production API | Route shells + API.md contracts |
| Actual media recording | Not supported by design |
| Actual report submission | `submitReport()` throws `Not implemented` |
| Production chat UI | Component shells only |
| Real push notifications | Out of scope (see PRD non-goals) |
| Production rate limiting | Policy documented, no limiter |
| Real device fingerprinting | Deliberately excluded (see ABUSE_PREVENTION.md) |
| Production deployment | DEPLOYMENT.md is a plan, not a pipeline |

---

## Safety position

**StrangerLink must not be designed as an unrestricted anonymous chat system.**

Trust & Safety is a first-class subsystem with its own bounded contexts
(`moderation`, `reports`, `blocks`, `bans`, `safety`), its own ADRs, its own
requirements, and its own traceability rows.

The architecture explicitly covers:

- age gating
- consent
- reporting
- blocking
- moderation
- abuse detection
- spam prevention
- rate limiting
- ban enforcement
- session safety
- illegal-content escalation policy
- privacy
- retention
- moderation auditability
- safe defaults

We do **not** design features intended to bypass moderation, law enforcement, safety
controls, device bans, or platform policies. The product does not claim perfect
moderation. See [SAFETY.md](SAFETY.md) — "Limitations we will not hide".

---

## Documentation map

### Root documents

| Document | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Product requirements, requirement IDs, acceptance criteria |
| [DESIGN.md](DESIGN.md) | UX principles and screen specifications |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, boundaries, data flow |
| [ADR.md](ADR.md) | ADR index |
| [AGENTS.md](AGENTS.md) | Mandatory workflow for future coding agents |
| [SKILLS.md](SKILLS.md) | Installed agent skill inventory and mapping |
| [DOMAIN.md](DOMAIN.md) | Bounded contexts and dependency direction |
| [DATA_MODEL.md](DATA_MODEL.md) | Entities and where state lives |
| [API.md](API.md) | Planned API boundary contracts |
| [EVENTS.md](EVENTS.md) | Conceptual domain events |
| [STATE_MACHINE.md](STATE_MACHINE.md) | Session lifecycle and transitions |
| [MATCHMAKING.md](MATCHMAKING.md) | Conceptual matching flow |
| [WEBRTC.md](WEBRTC.md) | Media plane architecture |
| [SIGNALING.md](SIGNALING.md) | Signaling message contracts |
| [SAFETY.md](SAFETY.md) | Safety policy and enforcement |
| [MODERATION.md](MODERATION.md) | Moderation architecture |
| [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) | Anti-abuse defenses |
| [SECURITY.md](SECURITY.md) | Application security requirements |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Threat register incl. realtime threats |
| [PRIVACY.md](PRIVACY.md) | Privacy commitments and data minimisation |
| [RETENTION.md](RETENTION.md) | Retention schedule per data class |
| [PERFORMANCE.md](PERFORMANCE.md) | Latency and resource budgets |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG 2.2 AA plan |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Metrics, traces, alerts |
| [TESTING.md](TESTING.md) | Test strategy |
| [QA.md](QA.md) | Manual QA scenarios |
| [ROADMAP.md](ROADMAP.md) | Vertical slices VS-0 … VS-15 |
| [TASKS.md](TASKS.md) | Task register with `T-*` IDs |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment plan |
| [OPERATIONS.md](OPERATIONS.md) | Operational ownership |
| [RUNBOOK.md](RUNBOOK.md) | Incident runbooks |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution rules for this repo |
| [GLOSSARY.md](GLOSSARY.md) | Terms |

### `docs/`

| Path | Contents |
| --- | --- |
| `docs/research/STACK-2026.md` | 2026 stack validation (SELECTED / PLANNED / OPTIONAL / REJECTED) |
| `docs/adr/` | ADR-001 … ADR-016 |
| `docs/architecture/` | Final architecture review, system context |
| `docs/design/` | Page inventory, component inventory |
| `docs/product/` | User journeys, product metrics |
| `docs/realtime/` | Realtime failure model, protocol notes |
| `docs/safety/` | Reporting, blocking, age gating, minors |
| `docs/security/` | Security control checklist |
| `docs/testing/` | Test matrix |
| `docs/operations/` | Operational procedures |
| `docs/TRACEABILITY.md` | Requirement → design → ADR → module → task → skeleton → test |

---

## Repository skeleton

```
Root documents (34)
README.md  PRD.md  DESIGN.md  ARCHITECTURE.md  ADR.md  AGENTS.md  SKILLS.md
DOMAIN.md  DATA_MODEL.md  API.md  EVENTS.md  STATE_MACHINE.md  MATCHMAKING.md
WEBRTC.md  SIGNALING.md  SAFETY.md  MODERATION.md  ABUSE_PREVENTION.md
SECURITY.md  THREAT_MODEL.md  PRIVACY.md  RETENTION.md  PERFORMANCE.md
ACCESSIBILITY.md  OBSERVABILITY.md  TESTING.md  QA.md  ROADMAP.md  TASKS.md
DEPLOYMENT.md  OPERATIONS.md  RUNBOOK.md  CONTRIBUTING.md  GLOSSARY.md  CHAT.md

docs/
├── adr/           ADR-001 … ADR-016, each with all ten required sections
├── architecture/  FINAL-REVIEW.md (21 review questions)
├── design/        PAGES.md (page inventory), COMPONENTS.md
├── product/       JOURNEYS.md (12 journeys), METRICS.md
├── realtime/      FAILURE-MODEL.md
├── safety/        REPORTING.md, BLOCKING.md, AGE-GATING.md, MINORS.md
├── security/      CONTROLS.md (78 controls)
├── testing/       MATRIX.md
├── operations/    ON-CALL.md
└── research/      STACK-2026.md (SELECTED / PLANNED / OPTIONAL / REJECTED)

src/
├── app/            route shells: page, start, queue, chat/[sessionId], safety
├── features/       ports: participant, queue, matchmaking, session, chat,
│                   signaling, media, reports, blocks, moderation, safety
├── domain/         types + invariants: participant, matchmaking, session,
│                   reports, moderation, safety
├── server/         ports: auth, realtime, db, moderation, rate-limit, telemetry
└── shared/         contracts (signaling, events, api), ui (11 component shells)

tests/
├── unit/           session.invariants, matchmaking, reports, chat,
│                   rate-limit, telemetry, ban-enforcement
├── integration/    retention + schema guard
├── realtime/       signaling protocol, media
└── e2e/            report/block/entry/exit, accessibility
```

Every module in `src/` is a **shell**: types, interfaces, DTOs, enums, state
definitions, protocol message contracts, repository ports, service ports, route
shells, component shells, and `NotImplemented` functions.

Every test file contains **only** `describe.todo` / `test.todo` placeholders. They
fail loudly if run, which is the point: an unimplemented test must not silently
pass.

---

## Quick orientation for a new contributor

1. Read [PRD.md](PRD.md) — what we are building and for whom.
2. Read [SAFETY.md](SAFETY.md) — the non-negotiable constraints.
3. Read [ARCHITECTURE.md](ARCHITECTURE.md) + [docs/adr/](docs/adr/) — how it fits together.
4. Read [AGENTS.md](AGENTS.md) — the mandatory workflow before you write code.
5. Read [ROADMAP.md](ROADMAP.md) — the order things get built.
6. Read [TASKS.md](TASKS.md) — the task you are assigned, and its constraints.

The smallest future implementation slice is **VS-3: Text Match** — anonymous identity →
join queue → match two users → text chat → disconnect → requeue. It is **not**
implemented here. Video comes much later.

---

## Licence / status

Status: **ARCHITECTURE PHASE — NOT DEPLOYABLE.**

No random-chat feature is implemented. Do not deploy this repository.
