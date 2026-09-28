# REALITY AUDIT — strangerlink-random-chat-webrtc-spec

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `DEMO_ONLY`**

## 1. Two READMEs, two products

| Document | Claim |
|---|---|
| `README.md:205-207` | "Status: **ARCHITECTURE PHASE — NOT DEPLOYABLE.** No random-chat feature is implemented. Do not deploy this repository." |
| `README.md:24-27, 39` | Forbidden-in-this-phase table: real matchmaking = *port only*; working signaling = *message contracts only*; real WebSocket = *transport port only*; "actual report submission: `submitReport()` throws `Not implemented`" |
| `README.md:180-181` | "Every module in `src/` is a **shell** … Every test file contains **only** `describe.todo`/`test.todo` placeholders" |
| `README.md_IMPLEMENTATION.md:3` | "Status: **IMPLEMENTED — All 33 tasks DONE**" |

Measured: `grep -rn "Not implemented" src/features/reports/reports.service.ts` → **nothing**. The file
is a 100-line implementation: rate limit 5 reports/hour/identity, session existence check, participant
authorization, category validation, HTML stripping, `(session, category)` dedup, automatic moderation
case creation, P0 escalation event, and a two-field acknowledgement.

The 18 remaining `NotImplemented` identifiers in `src/` are **aliases**, not gaps:

```ts
export const createNotImplementedMatchmakingService = createMatchmakingService;
```

`TASKS.md` has 32 `DONE` rows and 1 `DONE (with documented stub for prod secret)` — 33, consistent with
`README_IMPLEMENTATION.md`, not with `README.md`.

`README.md` is the pre-implementation artefact. It was never removed and, because of its filename, it
is the one a reader opens first.

## 2. Gate status (measured)

| Gate | Command | Exit | Note |
|---|---|---:|---|
| install | `npm ci` | 0 | |
| typecheck | `npm run typecheck` | 0 | |
| lint | `npm run lint` | **127** | `package.json:15` declares the script; `eslint` is in neither `dependencies` nor `devDependencies` → `sh: 1: eslint: not found` |
| build | `npm run build` | 0 | |
| test | `npm test` | 0 | 10 files, **85 passed**, 0 failed, 9.02 s |
| e2e | — | not runnable | 20 `test.todo` remain in 10 files; `playwright` is not configured |

The missing `eslint` is why `.github/workflows/project-checks.yml` disabled `lint` for the **entire**
project matrix with the comment *"Lint was missing here, which is why a boundary-rule or token-contrast
regression could reach main without anything objecting."* One project's missing devDependency cost
six projects their lint gate. That is a root-level CI decision to reverse (see
[DOCUMENTATION_RECONCILIATION.md](../../DOCUMENTATION_RECONCILIATION.md) and the root `OWNERSHIP.md`).

## 3. Persistence reality

**NONE.** `find strangerlink… -name '*.sql' -not -path '*/node_modules/*'` → nothing. No migration
folder, no ORM, no database.

`src/server/db/in-memory.ts` holds queue, sessions, claims, blocks, bans, recent peers, rate limits,
safety events, reports, and moderation cases in process memory. The module's own comment is honest
about part of it:

> *"a durable-like store for safety records that in production would be PostgreSQL but here is
> in-memory for testability. All stores are singletons per process … Multi-instance would require
> Redis (ADR-003 gate)."*

The separation that matters for safety is that **ephemeral** state (queue, active sessions, message
buffers) genuinely does not need durability — that part is correct. The problem is that **safety
records** are in the same store: bans, reports, moderation cases, and safety events all evaporate on
restart or deploy. For a product whose stated non-negotiable is safety, a restart silently un-bans
everyone.

## 4. Security reality

No P0. This is the only project in the workspace where the security surfaces I could find are
implemented rather than declared:

- `src/server/auth/authorization.ts` — real admin capability matrix with `mfaVerified` and
  `ALLOW_DEVICE`-style gating; `T-SEC-071` tests pass.
- `src/server/moderation/ban-eviction.ts` / `ban-enforcement.ts` — enforcement paths with tests
  (`tests/unit/ban-enforcement.test.ts`).
- `src/server/rate-limit/rate-limiter.ts` — per-identity limits with a cooldown ladder; tested.
- `src/server/realtime/turn-credentials.ts` — 5-minute per-session credentials, banned identities
  refused, relay to private/loopback/link-local/metadata ranges blocked, secret from env and a
  documented fail-closed error in production.
- Age gate with both checkboxes unchecked by default and a genuinely disabled Continue button.
- Chat route consent enforcement with redirect on direct navigation.

Identity is deliberately pseudonymous and client-held, which is a legitimate design for this product,
not a shortcut. The weakness is not spoofing; it is that identity is **not durable**, so ban and report
history is lost.

GAP-P1-SLK-01 — safety records (`banStore`, `reportStore`, `moderationStore`, `safetyEventStore`) are
in-memory and lost on restart.
GAP-P1-SLK-02 — `npm run lint` is unrunnable, so the project has no static gate at all.

## 5. Runtime

Production build served on `:3120`; `/`, `/start`, `/queue`, `/chat/[sessionId]`, `/safety`,
`/privacy`, `/terms` all return `200`. `src/app/queue/page.tsx` opens a real WebSocket via
`createSignalingClient` and renders a live elapsed timer, cooldown and match state — it is not a
placeholder.

The realtime server is a **separate process** (`npm run realtime` → `src/server/realtime/server.ts`).
The pages will not function without it running, and nothing in `README.md` (the file a reader opens)
mentions that command. `README_IMPLEMENTATION.md` does.

## 6. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-SLK-001…004.

| Journey | Reality |
|---|---|
| UJ-SLK-001 consent + enter queue | works, requires `npm run realtime` |
| UJ-SLK-002 get matched and exchange text | works, single process only |
| UJ-SLK-003 report and leave safely | works; escalation recorded in memory only |
| UJ-SLK-004 a banned user is blocked | works within one process lifetime; **a restart clears the ban** |

## 7. What is needed for real users

1. Durable storage for bans, reports, moderation cases and safety events. This is the only thing
   standing between this project and `MVP_USABLE` for its own stated safety goals.
2. Make `npm run realtime` a first-class documented requirement of `README.md` (or serve the socket
   from the Next process), so a reader can start it.
3. Install `eslint` and re-enable `npm run lint` in CI for this project — and for the matrix.
4. Delete or archive `README.md`; keep `README_IMPLEMENTATION.md` as the single status document.
