# SKILLS

**Document ID:** DOC-SKILLS
**Status:** Phase 0
**Related:** `AGENTS.md`, `CONTRIBUTING.md`, `TASKS.md`

---

## 1. How to read this document

This file maps **capabilities** (what a contributor or agent must be *able to do* to complete a
task safely) to the tasks in `TASKS.md`. It describes required competencies and their limits —
it does not claim any specific third-party tool, plugin, or credential exists in this repository.

### 1.1 Environment inspection result (recorded 2026-09-26)

A capability check was performed before writing this file:

| Checked | Result |
| --- | --- |
| Agent-skill packages installed in this workspace (`~/.claude/skills`, `~/.agents`, `~/skills`, `/usr/share/agents/skills`, `/opt/skills`) | **None present** |
| Repository skill/manifest files | Only this `SKILLS.md` and `AGENTS.md` (project instructions, not installed capabilities) |
| Package manifests with installed dependencies | None — Phase 0 has no `node_modules` and installs nothing |
| Third-party credentials or integrations (payment provider, WhatsApp, map tiles, hosting) | Not provisioned, not assumed |

Consequence: **no third-party skill, plugin or integration is listed in this document as available.**
The matrix below therefore describes *required competencies* for the tasks in `TASKS.md`, each with an
explicit limit on what it must not be assumed to cover. Tooling and library choices remain governed by
`docs/research/STACK-2026.md` (SELECTED / PLANNED / OPTIONAL / REJECTED) — a SELECTED library is not a
skill, and its presence in the matrix below would be a fabrication.

**No skill, tool, or integration is fabricated here.** If a capability is not present in the
working environment, the task is blocked until a human with that capability is engaged
(see §4 "Engagement rules").

---

## 2. Capability matrix

| # | Capability | Needed for | Evidence of competence | Hard limits (must not be assumed) |
| --- | --- | --- | --- | --- |
| C-01 | **Product management / requirements engineering** | All tasks; PRD maintenance | Stable-ID requirements, acceptance criteria, scope defence | Cannot approve legal/compliance questions alone |
| C-02 | **Software architecture & ADR authorship** | VS-0, cross-cutting tasks | ADRs with context/decision/consequences/alternatives | Cannot silently change Accepted ADRs |
| C-03 | **TypeScript (strict) engineering** | Everything | Typed contracts, no `any` at boundaries, discriminated unions | Must respect domain purity rules |
| C-04 | **Next.js App Router / React 19** | `src/app`, `src/features/*` UI | Route handlers, RSC/client boundary discipline, PWA patterns | Must not adopt opt-in unstable features (Cache Components) without an ADR |
| C-05 | **PWA / service worker engineering** | T-OFF-002 | Precaching, update policy, cache purge on logout | Must not introduce background tracking or sync loops |
| C-06 | **Offline-first client engineering (IndexedDB, outbox, conflict UX)** | T-OFF-001..004, T-SALE-003, T-CLOSE-003 | Idempotent queues, dependency-ordered sync, quarantine | Must not let the device decide money state |
| C-07 | **PostgreSQL data modelling** | VS-0..VS-10 | Constraints as invariants (partial unique indexes), migrations | No `db push` on shared environments |
| C-08 | **SQL-first data access (Drizzle)** | All server tasks | Readable SQL, parameterisation, no N+1 surprises | No ORM magic in the money path |
| C-09 | **Fintech correctness / money handling** | T-FOUND-006, T-SALE-*, T-CLOSE-* | Integer minor units, rounding policy, reconciliation thinking | No float arithmetic, no "close enough" |
| C-10 | **Payments & QRIS domain knowledge (Indonesia)** | T-PAY-001..004, `docs/payments/*` | Static vs dynamic QR, provider-mediated onboarding, signed callbacks, settlement matching | Must not implement a gateway without provider contract + ADR |
| C-11 | **Accounting-adjacent literacy (without becoming accounting)** | T-CLOSE-*, T-EXP-* | Expected vs actual, variance semantics, why no ledger here | Must not add double-entry or tax logic |
| C-12 | **Inventory operations literacy** | T-STOCK-* | Movements vs positions, variance reasons, custody boundaries | Must not model warehouse ERP complexity |
| C-13 | **Security engineering (web/app)** | T-SEC-*, T-AUTHZ-001, review gate | OWASP-class defences, threat modelling, secret hygiene | Cannot self-approve security-relevant changes |
| C-14 | **Privacy engineering (UU PDP literacy)** | T-OPS-001, all personal-data tasks | Minimisation, purpose binding, DSAR mechanics, 72 h breach awareness | Must escalate legal interpretation |
| C-15 | **Testing engineering (Vitest 4, Playwright, Browser Mode)** | All tasks | Real-browser component tests, real-Postgres integration tests, e2e offline simulation | Must not mock the database for invariant tests |
| C-16 | **UX engineering for low-end mobile** | `src/shared/ui`, operator screens | Tap budgets, one-handed layout, jargon-free copy, sunlight mode | Must not trade speed for visual polish |
| C-17 | **Accessibility engineering (WCAG 2.2 AA, field conditions)** | All operator surfaces | Contrast/size assertions, focus order, screen-reader labelling | Manual field validation still required |
| C-18 | **Observability engineering (OpenTelemetry)** | T-OBS-* | Spans/metrics/log correlation, bounded labels, no PII | Must not block request paths on telemetry |
| C-19 | **Containerisation & CI/CD (Docker, GitHub Actions)** | T-OPS-002 | Multi-stage builds, immutable artefacts, expand/contract migrations | No manual production edits |
| C-20 | **Operations & incident response (runbooks, on-call)** | T-OPS-003/004 | Runbooks, drills, blameless post-mortems | Must not page humans without an action |
| C-21 | **Code review & mentoring** | All PRs | Checklist discipline, respectful actionable feedback | Reviewers cannot waive money/privacy checks |
| C-22 | **Indonesian language & local operational context** | Operator copy, QA, field pilot | Plain Bahasa Indonesia field vocabulary, local street-food reality | Must not use regional idiom in labels without review |

---

## 3. Skill → task mapping (high-value subset)

| Task group | Required capabilities |
| --- | --- |
| T-FOUND-001..002 | C-03, C-04, C-16, C-17, C-19, C-21 |
| T-FOUND-003..004 | C-03, C-07, C-08, C-09, C-13, C-15 |
| T-FOUND-005..006 | C-03, C-09, C-13 |
| T-OP-*, T-STALL-* | C-02, C-03, C-07, C-13, C-14 |
| T-LOC-* | C-03, C-06, C-14 (location privacy rules), C-16 |
| T-SHIFT-*, T-OFF-001 | C-03, C-06, C-07, C-09, C-15 |
| T-MENU-*, T-PRICE-* | C-03, C-07, C-09, C-15 |
| T-SALE-* | C-06, C-08, C-09, C-15 |
| T-PAY-* | C-10, C-09, C-13, C-15 |
| T-EXP-*, T-STOCK-* | C-09, C-11, C-12, C-14, C-22 |
| T-CLOSE-* | C-09, C-11, C-15 |
| T-HQ-* | C-04, C-07, C-16, C-18 |
| T-LOY-* | C-09, C-13, C-14, C-15 |
| T-COMM-*, T-ALERT-* | C-04, C-16, C-18 |
| T-INC-* | C-14, C-20, C-22 |
| T-PERF-*, T-REC-* | C-02, C-09, C-14 (fairness), C-21 |
| T-SEC-* | C-13, C-14, C-15 |
| T-OBS-* | C-18, C-20 |
| T-OPS-* | C-19, C-20 |

---

## 4. Engagement rules (no fabricated capabilities)

1. If a task requires a capability marked as **not present** in the working environment, the
   task is **blocked** and the gap is recorded in the PR/issue — never worked around silently.
2. External capabilities requiring an account, credential, or contract (payment provider,
   WhatsApp Business, map tile vendor, SMS gateway, hosting) must be **procured and documented**
   before their task starts; the skeleton must not pretend they exist.
3. Domain-expert review (a real human: finance, legal, or field operations) is required for:
   money semantics changes, expense policy wording, recognition fairness, and privacy notices.
4. Any contributor (human or agent) may pause a task to request product clarification. Guessing
   product behaviour is a defect injection.

---

## 5. Limitations

- This document describes **competencies**, not installed packages; nothing here implies a
  dependency exists (`docs/research/STACK-2026.md` governs libraries).
- Field usability cannot be assessed from a desk; C-16/C-17 work always includes real-device
  testing in sun and with gloves (see `QA.md` §3.9).
- Legal interpretation (UU PDP, payment regulation) is explicitly out of scope for engineering
  contributors; escalate.
