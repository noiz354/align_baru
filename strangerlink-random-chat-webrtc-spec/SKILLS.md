# StrangerLink — Agent Skills Inventory

- **Status:** Complete (inventory of actually installed skills)
- **Last updated:** 2026-09-26
- **Method:** The workspace and standard agent-skill locations were inspected directly.
  **No skills were fabricated.** Where a capability is absent, it is recorded as absent.

---

## 0. Inventory result

### Installed Agent Skills

| Count | Skills found |
| --- | --- |
| **0** | **None** |

The following locations were inspected:

| Location | Result |
| --- | --- |
| `/home/user/.claude/skills` | Does not exist |
| `/home/user/.agents` | Does not exist |
| `/home/user/.codex` | Does not exist |
| `/home/user/.gemini` | Does not exist |
| `/home/user/.config` | Empty of skill definitions |
| `/home/user/.local/share` | Empty of skill definitions |
| `/root/.claude`, `/root/.codex` | Do not exist |
| `~/.claude/skills` | Does not exist |
| Filesystem-wide search for `SKILL.md` | One hit only: `typer/.agents/skills/typer/SKILL.md` — a CLI-framework skill bundled inside a Python package, **not an installed agent skill** and not applicable to this project |

**Conclusion: no agent skills are installed in this environment.** There is nothing to map.

---

## 1. What this means for the project

Nothing in the architecture depends on a specific skill being present. The skills below are
the capabilities this project *would* benefit from if they were installed. They are listed
so that a future agent knows what to look for, and so that nobody mistakes this list for an
inventory of what exists.

**These are NOT installed. Do not cite them as available.**

---

## 2. Desired skills and their purpose

| Capability | Source (if installed) | Purpose | Applicable tasks | When to load | Expected output | Limitations |
| --- | --- | --- | --- | --- | --- | --- |
| **Architecture** | — | Bounded contexts, dependency direction, module boundaries | All | Before any structural change | A module map consistent with [DOMAIN.md](DOMAIN.md) | Cannot decide safety policy |
| **ADR authoring** | — | Context / drivers / options / decision / consequences / risks / mitigations / revisit | Any decision change | Before implementing a decision change | A complete ADR with all ten sections | Cannot validate the decision's correctness |
| **Next.js** | — | App Router, RSC boundary, route shells, `instrumentation.js` | VS-0 onward | Before any `app/` change | Route shells and server components | Cannot replace ADR-001 |
| **React** | — | Component composition, hooks, focus management | VS-0 onward | Before any UI change | Accessible components | Cannot decide UX policy |
| **TypeScript** | — | Strict mode, discriminated unions, type inference from Zod | VS-0 onward | Before any typed change | Strict, well-typed code | Cannot choose the stack |
| **WebRTC** | — | `RTCPeerConnection`, ICE, SDP, device handling, restart | VS-8 … VS-11 | Before any media change | Media lifecycle code | Cannot decide topology (ADR-005) |
| **WebSockets** | — | `ws` server lifecycle, handshake auth, heartbeats, drain | VS-2 onward | Before any realtime change | A secure transport | Cannot decide the protocol (ADR-004) |
| **Realtime systems** | — | Concurrency, races, idempotency, ordering, reconnect | VS-3 onward | Before any matchmaking or session change | Race-resolved code | Cannot enumerate the races for you — read [STATE_MACHINE.md](STATE_MACHINE.md) |
| **PostgreSQL** | — | Schema design, migrations, retention jobs, indexing | VS-7 onward | Before any `server/db` change | Migrations and queries behind ports | Cannot decide retention (ADR-013) |
| **Security / OWASP** | — | XSS, CSRF, injection, IDOR, authz | VS-0 onward | Before any boundary change | Verified controls | Cannot replace [SECURITY.md](SECURITY.md) |
| **Trust & Safety** | — | Reporting, moderation, escalation, enforcement ladders | VS-6 onward | Before any safety change | Enforceable policy | Cannot replace [SAFETY.md](SAFETY.md) |
| **Abuse prevention** | — | Rate limits, cooldowns, bot detection, evasion | VS-13 | Before any abuse control | Proportional controls | Cannot justify fingerprinting — see [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) |
| **Privacy** | — | Data minimisation, retention, disclosure | VS-0 onward | Before any data change | A minimal data inventory | Cannot decide retention tiers |
| **Testing** | — | Vitest, Playwright, fake media devices, multi-context | VS-0 onward | Before writing tests | Reliable, deterministic tests | Cannot decide what must be tested — read [TESTING.md](TESTING.md) |
| **Playwright** | — | E2E, multi-context, permission overrides, axe | VS-3 onward | Before E2E work | Journey coverage | Cannot replace [QA.md](QA.md) |
| **Load testing** | — | WebSocket ramp, match throughput, flood scenarios | VS-15 | Before production hardening | Capacity evidence | Cannot set the budgets — read [PERFORMANCE.md](PERFORMANCE.md) |
| **OpenTelemetry** | — | Spans, metrics, OTLP, context propagation | VS-14 | Before any instrumentation | Envelope-only telemetry | Cannot weaken the no-content policy (ADR-015) |
| **Docker** | — | Multi-stage builds, non-root, segmentation | VS-0 onward | Before any deployment change | Secure images | Cannot decide topology (ADR-016) |
| **Code review** | — | The checklist in [AGENTS.md](AGENTS.md) §6 | Every change | Before merge | A reviewed change | Cannot substitute for the checklist |

---

## 3. How to use this document

When a skill **is** installed in your environment:

1. Verify it exists — do not assume from this list.
2. Record it in the table above with its actual name and source.
3. Map it to the tasks where it applies.
4. Note its limitations honestly.

When no skill is installed, the authoritative sources for this project are the documents in
this repository. They are the specification. A skill is a convenience, never a substitute.

---

## 4. Standing instruction

**Do not fabricate skill names.** An agent that claims a capability it does not have will
produce work that assumes unavailable tools. If you are unsure whether a skill is
installed, check, and if you cannot check, say so.
