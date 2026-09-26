# StrangerLink — Contributing

- **Status:** Architecture phase
- **Last updated:** 2026-09-26

---

## 0. Before you contribute

Read these, in this order:

1. [README.md](README.md) — what this repository is and is not.
2. [SAFETY.md](SAFETY.md) — the non-negotiable constraints.
3. [AGENTS.md](AGENTS.md) — the mandatory workflow and the pre-implementation checklist.
4. [TASKS.md](TASKS.md) — the task you are picking up.

**This repository contains no working random-chat features, and that is intentional.** If
your change would create one, it is out of scope for this phase.

---

## 1. The phase rule

| Allowed | Forbidden |
| --- | --- |
| Interfaces, types, DTOs, enums | Working matchmaking |
| State definitions | Real WebRTC negotiation |
| Protocol message contracts | A real WebSocket server |
| Repository and service ports | Real database access |
| Route shells | Moderation logic |
| Component shells | Persistent bans |
| `describe.todo` tests | Functional report persistence |
| `NotImplemented` functions | Real rate limiting |
| Documentation | Device fingerprinting |
| | A production deployment |

If a function would require business logic, network logic, matchmaking logic, moderation
logic, or persistence, **leave it unimplemented** and throw:

```typescript
throw new Error("Not implemented: T-<TASK-ID>");
```

---

## 2. Workflow

```
1. Pick a task from TASKS.md
2. Read its requirements, design references, and ADRs
3. Answer the nine pre-implementation questions in AGENTS.md §2
4. Make the smallest coherent change
5. Write the tests the task names
6. Update the documentation the change affects
7. Run the manual QA scenarios that apply
8. Open a pull request with the checklist completed
```

---

## 3. Pull request requirements

Every PR must include:

- [ ] The task ID in the title or description
- [ ] Requirement IDs referenced
- [ ] ADR numbers referenced (or an explicit "no ADR affected")
- [ ] The nine pre-implementation questions answered
- [ ] Confirmation that no hard stop was crossed
- [ ] Tests for every documented race or safety property touched
- [ ] Documentation updated
- [ ] Confirmation that this is the smallest coherent change

A PR that cannot complete this checklist should not be opened.

---

## 4. Code standards

| Standard | Rule |
| --- | --- |
| TypeScript | `strict: true`, `noUncheckedIndexedAccess` |
| Validation | Zod at every untrusted boundary; the schema is the type |
| Naming | Task IDs in `Not implemented` messages and TODOs |
| Comments | Reference requirement IDs, ADRs, and document sections |
| Imports | `domain/` imports only `shared/`; `server/` is `server-only`; `features/` uses public surfaces only |
| SQL | Only in `src/server/db/`; always parameterised |
| HTML | No `dangerouslySetInnerHTML`, ever |
| Errors | Never leak stack traces, queries, hostnames, or IPs to a client |
| TODOs | `TODO(T-<ID>): description` — always with a task ID |

---

## 5. Documentation standards

| Change | Required documentation |
| --- | --- |
| New requirement | `PRD.md` + `docs/TRACEABILITY.md` |
| New decision | A new ADR with all ten sections |
| New domain concept | `DOMAIN.md` + `DATA_MODEL.md` |
| New protocol message | `SIGNALING.md` + `src/shared/contracts/` |
| New safety behaviour | `SAFETY.md` + traceability |
| New state or transition | `STATE_MACHINE.md` |
| New race | `STATE_MACHINE.md` or `CHAT.md`, plus a test |
| New metric or alert | `OBSERVABILITY.md` + `RUNBOOK.md` |
| New retention period | `RETENTION.md` + ADR-013 review |
| New threat | `THREAT_MODEL.md` |

**Documentation is part of the change, not a follow-up.**

---

## 6. Migration policy

Database migrations follow **expand/contract**:

1. **Expand:** add the new column or table, nullable or with a default. Deploy.
2. **Migrate:** backfill if needed. Deploy.
3. **Contract:** remove the old column in a **later** release, after the code that used it
   is gone.

A destructive migration must never ship in the same release as the code change that stops
using the column. Rollback must always be possible.

---

## 7. Dependency policy

| Rule | Detail |
| --- | --- |
| Pin exact versions | No ranges in `package.json` |
| Commit the lockfile | Always |
| Audit in CI | `npm audit`; critical blocks release |
| Dependabot | Enabled; triage within the SLA below |
| Framework security releases | **Treated as safety incidents; patched within 72 hours** |
| New dependency | Requires justification in the PR: what it replaces, its maintenance status, its size cost, and its security history |
| Native dependencies | Require explicit justification — they complicate Docker builds and CI |

**The Next.js May 2026 advisory class** (middleware/proxy authorization bypass) is the
reason framework security releases are treated as safety incidents here, and the reason
authorization is never middleware-only.

---

## 8. Security review triggers

A security review is required before merging any change that:

- adds an endpoint or a WebSocket message type
- touches authentication or authorization
- adds or changes a Zod schema at an untrusted boundary
- touches `src/server/**`
- adds a dependency
- changes a cookie, header, or CSP directive
- touches TURN credential handling
- adds an admin route or role

---

## 9. Safety review triggers

A Trust & Safety review is required before merging any change that:

- touches the age gate or consent flow
- touches reporting or blocking
- changes moderation outcomes or the enforcement ladder
- changes ban enforcement or its entry points
- changes the escalation policy
- changes a retention period
- adds any user-visible safety copy
- changes what moderators can see

---

## 10. Prohibited changes

These will be rejected without discussion:

- Adding durable storage of chat content or media.
- Adding `MediaRecorder`, stream capture, or a media upload path.
- Adding device fingerprinting.
- Adding an IP ban.
- Weakening, hiding, or gating reporting or blocking.
- Making it harder to leave.
- Adding an automated content-moderation model without a new ADR and a privacy impact
  assessment.
- Allowing a client to supply a session identifier.
- Moving authorization into middleware alone.
- Adding a message broker, an SFU, or Redis without an ADR.
- Extending a retention tier without the ADR-013 review.
- Claiming a safety property the system does not have.
- Adding a gamification, streak, or popularity feature.

---

## 11. Commit messages

```
<type>(<task-id>): <summary>

<why, and what requirement it serves>

Refs: FR-XXX-NNN, ADR-0NN
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `adr`, `safety`.

---

## 12. Review SLA

| PR type | First review |
| --- | --- |
| Documentation | 2 business days |
| Skeleton / types | 2 business days |
| Safety or security | 1 business day |
| Security incident fix | Same day |

---

## 13. Getting help

- Requirement unclear → ask in the PR; do not guess.
- Requirement and ADR disagree → escalate to the architecture owner.
- Safety requirement conflicts with a privacy commitment → escalate; do not resolve it
  yourself.

**An undocumented decision made by a contributor becomes an undocumented decision in the
codebase.** Ask.
