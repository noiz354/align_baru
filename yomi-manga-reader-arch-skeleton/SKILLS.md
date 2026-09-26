# SKILLS.md — Agent Skills & Capabilities

Date: 2026-09-27 · Scope: which agent skills apply to the work in TASKS.md, and which installed skills deliberately do not. **Every skill name below was verified present on disk before being written here.**

---

## 1. Correction to the Previous Revision

The 2026-09-26 revision of this file stated:

> "there is **no external 'Agent Skills' registry' in this environment (no skill packages, no marketplace, no CLAUDE-skills-style directory)"

**That statement is now false and is superseded.** It was accurate for the sandbox the specification was authored in (`/home/user`, no package registry reachable). This repository is now developed in an environment with **340 installed agent skills** across two roots:

| Root | Count | Installed via | How to load |
|---|---|---|---|
| `~/.agents/skills/` | 80 | `skills` registry (GitHub-sourced) | `use_skill <name>` / auto-trigger on `description` match |
| `~/.config/opencode/skills/` | 260 | opencode native | same |

Everything below reflects the **current** environment. If you port this repository back to a bare sandbox, treat §5 as unavailable and fall back to the model + this documentation suite, exactly as the previous revision did.

**Load rule:** a skill is *available* if its directory exists. Do not name a skill you have not verified. §6 lists skills that are installed but **must not** be used here.

---

## 2. How These Skills Interact With This Repository

The specification suite is authoritative (AGENTS.md §0). Skills are **advisory execution aids**, never a source of requirements:

- A skill never overrides a requirement (`FR-*`), an Accepted ADR, or a task's DoD.
- If a skill's advice contradicts this documentation, **the documentation wins** — record the contradiction as a `spec-question` (AGENTS.md §6), do not silently pick.
- Skills are loaded **per task family**, not wholesale. Loading all 24 named skills at once costs more context than it returns.

---

## 3. Routing by Task Family

Load the listed skills when you pick up a task whose ID matches the family. Counts are the number of task entries (`## T-*` headings) in TASKS.md — 134 total.

| Task family | # | Primary skills | Why these |
|---|---|---|---|
| `T-FOUND-*` | 12 | `test-driven-development`, `docker-expert`, `verification-before-completion` | toolchain, boundary lint, CI gates, compose; TDD from the first commit |
| `T-CATALOG-*` | 10 | `typescript-advanced-types`, `backend-caching`, `supabase-postgres-best-practices`, `accessibility`, `frontend-ui-engineering` | cursor/pagination DTOs, cover caching headers, indexed queries, axe-clean catalog |
| `T-READER-*` | 33 | `typescript-advanced-types`, `test-driven-development`, `accessibility`, `performance-optimization`, `userflow` | reader state reducer + window math are pure functions (unit-testable), the input matrix is the a11y surface |
| `T-UPLOAD-*` | 15 | `backend-idempotency`, `backend-resilience-patterns`, `security-and-hardening`, `supabase-postgres-best-practices`, `typescript-advanced-types` | job state machine, retry/failure polish, upload trust boundary, single-transaction commit |
| `T-AUTH-*` | 13 | `security-and-hardening`, `backend-idempotency`, `api-and-interface-design`, `test-driven-development` | Argon2id, session revocation, uniform `AUTH_INVALID` (no existence leak) |
| `T-SEC-*` | 7 | `security-and-hardening`, `backend-contract-testing`, `backend-structured-logging` | hardening pass, contract conformance, audit trail without secrets |
| `T-LIB-*` | 9 | `typescript-advanced-types`, `supabase-postgres-best-practices`, `accessibility`, `frontend-ui-engineering` | progress merge logic, read-status queries, form + list a11y |
| `T-ADMIN-*` | 8 | `frontend-ui-engineering`, `accessibility`, `security-and-hardening`, `userflow` | admin is the least-tested surface; authorization on every route |
| `T-PERF-*` | 7 | `core-web-vitals`, `performance-optimization`, `web-quality-audit`, `supabase-postgres-best-practices`, `postgresql-optimization` | PERFORMANCE.md §3 matrix is a measured gate, not a guideline |
| `T-OBS-*` | 7 | `observability-and-instrumentation`, `backend-structured-logging`, `performance-optimization` | OTel + pino, trace↔log correlation, beacon instrumentation |
| `T-SEARCH-*` | 6 | `supabase-postgres-best-practices`, `backend-caching`, `typescript-advanced-types` | FTS/trigram + GIN indexes, result caching, query DTOs |
| `T-PROD-*` | 7 | `docker-expert`, `backend-resilience-patterns`, `observability-and-instrumentation`, `security-and-hardening` | worker container split, health/readiness, alerting, hardening |

**Always-on, any family:** `test-driven-development` (RED-GREEN-REFACTOR per the task's planned test IDs) and `verification-before-completion` (evidence before the DoD claim).

---

## 4. Routing by Vertical Slice

For slice-level work, the same skills condensed to the ones that carry the slice's exit criteria.

| Slice | Deliverable | Skills that carry its exit criteria |
|---|---|---|
| VS-0 Foundation | bootable dev env, boundary lint, CI | `test-driven-development`, `docker-expert`, `verification-before-completion` |
| VS-1 Catalog | browsable/filterable catalog | `typescript-advanced-types`, `backend-caching`, `supabase-postgres-best-practices`, `accessibility` |
| VS-2 Minimal Reader | vertical + single mode, RTL/LTR, progress | `typescript-advanced-types`, `test-driven-development`, `accessibility` |
| VS-3 Reader Navigation | full input matrix, zero CLS | `accessibility`, `userflow`, `core-web-vitals` |
| VS-4 Reader Performance | 500-page case, bounded memory, 3G | `performance-optimization`, `core-web-vitals`, `web-quality-audit` |
| VS-5 Auth + Library | auth, library, progress merge | `security-and-hardening`, `backend-idempotency`, `backend-transactional-outbox`, `accessibility` |
| VS-6 Admin | admin panel | `frontend-ui-engineering`, `security-and-hardening`, `accessibility` |
| VS-7 Upload Pipeline | secure ingest → ready chapter | `backend-idempotency`, `backend-resilience-patterns`, `security-and-hardening` |
| VS-8 Search | FTS/trigram search | `supabase-postgres-best-practices`, `backend-caching` |
| VS-9 Security Hardening | threat-model closure, live SMTP | `security-and-hardening`, `backend-contract-testing`, `backend-structured-logging` |
| VS-10 Observability | OTel traces, dashboards, alerts | `observability-and-instrumentation`, `backend-structured-logging` |
| VS-11 Production Deployment | deploy topology, worker split | `docker-expert`, `backend-resilience-patterns`, `observability-and-instrumentation` |

---

## 5. Cross-Cutting Gates

| Gate | Skill | Applies to |
|---|---|---|
| RED-GREEN-REFACTOR on the planned test ID | `test-driven-development` | every task with a test row in TEST_STRATEGY.md |
| Evidence before claiming done | `verification-before-completion` | AGENTS.md §5 DoD |
| Any new query needs an index (NFR-PERF-014) | `supabase-postgres-best-practices` | `T-CATALOG`, `T-SEARCH`, `T-LIB` |
| Index/explain/connection-pool review | `postgresql-optimization` | schema changes, `T-PROD` tuning |
| API surface change | `backend-contract-testing` | `API_CONTRACT.md` §6, `T-SEC` |
| New trust boundary or input surface | `security-and-hardening` | `T-UPLOAD`, `T-AUTH`, `T-ADMIN` |
| User-visible change (axe + browser check) | `accessibility` | every `page.tsx` / `AppShell.tsx` edit |
| LCP/INP/CLS or residency claim | `core-web-vitals`, `performance-optimization` | `T-PERF`, VS-4 |
| New work not yet in TASKS.md (AGENTS.md §4.5) | `specdd` | task authoring only, never to bypass TASKS.md |
| Independent lanes across modules | `dispatching-parallel-agents` | only where `docs/architecture/dependency-rules.md` proves disjoint write scopes |
| Password-reset / notification side effects | `backend-transactional-outbox` | VS-5 mail capture, VS-9 live SMTP |

**Reader journey documentation** (`J-1`…`J-6` in `docs/product/`): `userflow` produces an HTML flow report when a journey's states need visual review. It documents a journey; it never becomes the spec.

---

## 6. Installed Skills That Do NOT Apply Here

Listed so an agent does not load them by keyword match. Each is installed and healthy — it is simply wrong for this stack.

| Skill group | Why not |
|---|---|
| `golang-testing`, `golang-security`, `golang-database`, `golang-observability` | **No Go in this repository.** Stack is TypeScript/Next.js 16 (ADR-001). Go work belongs to a different project. |
| `python-code-style`, `python-anti-patterns`, `python-testing-patterns`, `python-type-safety`, `python-error-handling`, `python-resilience` | **No Python in this repository.** |
| `agentic-eval`, `rag-evaluation-matrix`, `mcp-agent-evaluation` | **No LLM and no agent loop in the product.** These evaluate model behaviour; Yomi evaluates itself with Vitest/Playwright and the PERFORMANCE.md matrix. |
| `eval-driven-dev` | Same reason. Its *generic* quality-gate framing is already covered by `verification-before-completion`; its RAG/agent sections do not apply. |
| `prompt-engineering-patterns`, `claude-api` | **No model provider is called anywhere in this product.** |
| `mcp-builder` | No MCP server is part of this architecture (7 services are all in-repo). |
| `backend-event-driven` | **There is no event bus.** Upload async work is a **Postgres job row** (job state machine, ARCHITECTURE.md data flow); telemetry is OTel. Do not introduce a broker to "fix" this. |
| `backend-message-queue` | Partially relevant **only** for the DB job queue's claim/consume pattern in the worker container (VS-4/VS-11). Its Kafka/RabbitMQ guidance does not apply — there is no broker. |
| `redis-patterns` | No Redis. Caching is HTTP/CDN + Postgres-backed (ADR-004). Use `backend-caching` instead. |
| `design-research-ux-artifacts` | Research-phase artifact generation. This repository is past discovery; the PRD and journeys are accepted. |
| `ui-design` | For net-new visual surfaces. Reader UI here is constrained by `ACCESSIBILITY.md` + existing `AppShell.tsx`; use `accessibility` + `frontend-ui-engineering`. |

**Guard:** if a task seems to need one of these, the task is mis-specified. Re-read the ADR for that subsystem before reaching for a skill outside §3–§5.

---

## 7. Verification Commands

```bash
# a skill is available iff its directory exists
test -f ~/.agents/skills/<name>/SKILL.md || test -f ~/.config/opencode/skills/<name>/SKILL.md

# names referenced by this file all resolve (run after any install/remove)
for s in typescript-advanced-types test-driven-development verification-before-completion \
         supabase-postgres-best-practices postgresql-optimization backend-caching \
         backend-idempotency backend-transactional-outbox backend-resilience-patterns \
         backend-structured-logging backend-contract-testing accessibility \
         core-web-vitals performance-optimization web-quality-audit \
         frontend-ui-engineering observability-and-instrumentation security-and-hardening \
         docker-expert specdd userflow dispatching-parallel-agents; do
  test -f ~/.agents/skills/$s/SKILL.md -o -f ~/.config/opencode/skills/$s/SKILL.md \
    || echo "MISSING: $s"
done
```

The expected output of the second command is **nothing**.
