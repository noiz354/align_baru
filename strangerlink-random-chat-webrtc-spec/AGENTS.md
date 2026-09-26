# StrangerLink — Agent Workflow

- **Status:** Mandatory
- **Last updated:** 2026-09-26
- **Audience:** Any coding agent (human or AI) contributing to this repository.

---

## 0. Read this first

This repository is in the **documentation + architecture + skeleton** phase. There is no
working random-chat feature and there must not be one until a vertical slice is explicitly
started.

If you are an agent asked to "implement" something, your first job is to determine whether
implementing it is in scope. If it is not, **stop and say so.**

---

## 1. Mandatory workflow

```
TASK
  ↓
REQUIREMENTS
  ↓
DESIGN
  ↓
ADR
  ↓
SAFETY / SECURITY
  ↓
CURRENT CODE
  ↓
IMPLEMENT
  ↓
TEST
  ↓
MANUAL QA
```

Each step is a gate. Do not proceed past a gate until it is satisfied.

### Step 1 — TASK

Identify the task ID from [TASKS.md](TASKS.md). If the work has no task ID, it is not a
sanctioned change. Create one, or stop.

### Step 2 — REQUIREMENTS

Find the requirement IDs the task references. Read them in [PRD.md](PRD.md). If the change
would violate a requirement, stop and escalate.

### Step 3 — DESIGN

Read the design documents the task references. Confirm the change matches the documented
behaviour. If the design is silent, write the design first — do not improvise.

### Step 4 — ADR

Read the ADRs the task references. If the change would alter a decision recorded in an ADR,
**write a new ADR or supersede the old one before writing code.** Never quietly contradict
an ADR.

### Step 5 — SAFETY / SECURITY

Complete the pre-implementation checklist in §2. **Every item must be answered.** A blank
or "n/a" on items 1–6 is a stop condition.

### Step 6 — CURRENT CODE

Read the existing module, its ports, and its tests. Understand the boundaries you are about
to cross. Do not refactor adjacent code in the same change.

### Step 7 — IMPLEMENT

Make the **smallest coherent change** that satisfies the task. Do not add speculative
abstractions, configuration, or features.

### Step 8 — TEST

Write the tests the task names. If a race is documented, test the race. If a safety
property is documented, test the property.

### Step 9 — MANUAL QA

Run the QA scenarios in [QA.md](QA.md) that apply. Safety scenarios are release blockers.

---

## 2. Pre-implementation checklist

Before writing any code, answer all nine:

| # | Question | Where to look |
| --- | --- | --- |
| 1 | **Requirement** — which requirement IDs does this serve, and does it violate any? | [PRD.md](PRD.md) |
| 2 | **ADR** — which ADRs apply, and does this contradict any? | [ADR.md](ADR.md), `docs/adr/` |
| 3 | **Safety impact** — could this weaken age gating, reporting, blocking, moderation, escalation, or session safety? | [SAFETY.md](SAFETY.md) |
| 4 | **Privacy impact** — does this add, retain, log, or expose personal data? | [PRIVACY.md](PRIVACY.md), [RETENTION.md](RETENTION.md) |
| 5 | **Abuse potential** — how could this be abused, and what stops it? | [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) |
| 6 | **Realtime race conditions** — which of R1–R12 or C1–C6 does this touch? | [STATE_MACHINE.md](STATE_MACHINE.md), [CHAT.md](CHAT.md) |
| 7 | **Module boundary** — does this respect the dependency direction? | [DOMAIN.md](DOMAIN.md) §3 |
| 8 | **Tests** — which tests must exist, and do they? | [TESTING.md](TESTING.md), the task entry |
| 9 | **Smallest coherent change** — is this the minimum change that works? | — |

### Hard stops

Stop and escalate if the change would:

- Add durable storage of chat content or media.
- Add a `MediaRecorder`, stream capture, or media upload path.
- Add device fingerprinting.
- Add an IP ban.
- Weaken, hide, or gate reporting or blocking behind anything.
- Make leaving harder.
- Add an automated content-moderation model without a new ADR and a privacy impact
  assessment.
- Allow a client to supply a session identifier.
- Move authorization into middleware alone.
- Add a message broker, an SFU, or Redis without an ADR.
- Extend a retention tier.
- Claim a safety property the system does not have.

---

## 3. Phase-specific rules (current phase)

The repository is in the **architecture phase**. The following are forbidden:

| Forbidden | Instead |
| --- | --- |
| Working matchmaking | Declare the port; throw `Not implemented: T-MATCH-021` |
| Real WebRTC negotiation | Declare `PeerConnectionCoordinator`; throw `Not implemented` |
| Working signaling | Define the message contract in `src/shared/contracts/` |
| Real WebSocket server | Declare the transport port |
| Real database access | Declare repository ports; import no driver |
| Moderation logic | Declare the moderation port |
| Persistent bans | Model the entity in `DATA_MODEL.md` |
| Functional authentication | Declare the auth port |
| Real report submission | `submitReport()` throws `Not implemented: T-REPORT-006` |
| Production chat UI | Component shells with `TODO(T-CHAT-001)` |
| Real rate limiting | Declare the rate-limit port |
| Real device fingerprinting | Do not declare it at all |
| Real push notifications | Not in scope |
| Production deployment | `DEPLOYMENT.md` is a plan |

### Allowed in this phase

- interfaces, types, DTOs, enums
- state definitions
- protocol message contracts
- repository ports
- service ports
- route shells
- component shells
- `describe.todo` tests
- `NotImplemented` functions

---

## 4. Code conventions

| Convention | Rule |
| --- | --- |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess` |
| Validation | Zod at every untrusted boundary; the schema is the single source of truth for the type |
| Naming | Task IDs appear in `Not implemented: T-<ID>` messages |
| Comments | Reference requirement IDs, ADR numbers, and document sections |
| Imports | `domain/` imports only `shared/`; `server/` is `server-only`; `features/` uses other features' public surfaces only |
| SQL | Only inside `src/server/db/`; always parameterised |
| HTML rendering | No `dangerouslySetInnerHTML`, ever |
| Errors | Never leak stack traces, queries, hostnames, or IPs to a client |
| TODOs | `TODO(T-<ID>): description` — always with a task ID |

---

## 5. Documentation obligations

| Change | Documentation required |
| --- | --- |
| New requirement | `PRD.md` + `docs/TRACEABILITY.md` |
| New decision | A new ADR |
| New domain concept | `DOMAIN.md` + `DATA_MODEL.md` |
| New protocol message | `SIGNALING.md` + `src/shared/contracts/` |
| New safety behaviour | `SAFETY.md` + traceability |
| New state or transition | `STATE_MACHINE.md` |
| New race | `STATE_MACHINE.md` or `CHAT.md`, plus a test |
| New metric or alert | `OBSERVABILITY.md` + `RUNBOOK.md` |
| New retention period | `RETENTION.md` + ADR-013 review |
| New threat | `THREAT_MODEL.md` |

Documentation is not a follow-up task. It is part of the change.

---

## 6. Review checklist

A reviewer must verify:

- [ ] The task ID exists in [TASKS.md](TASKS.md)
- [ ] Requirement references are present and correct
- [ ] No ADR is contradicted
- [ ] The nine pre-implementation questions are answered
- [ ] No hard stop was crossed
- [ ] Tests exist for every documented race and safety property touched
- [ ] Documentation was updated
- [ ] The change is the smallest coherent one
- [ ] Nothing from the forbidden list was implemented

---

## 7. Escalation

Escalate to the architecture owner when:

- A requirement and an ADR disagree.
- A safety requirement cannot be met without a privacy cost.
- A task cannot be completed as the smallest coherent change.
- The correct behaviour is genuinely undocumented.

**Do not resolve these by guessing.** An undocumented decision made by an agent becomes an
undocumented decision in the codebase.
