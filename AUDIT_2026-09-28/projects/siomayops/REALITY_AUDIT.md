# REALITY AUDIT — siomayops-streetfood-stall-ops-spec

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `MVP_BLOCKED`**

## 1. What the code actually is

A working Next.js 15 operations app: 37 API routes under `src/app/api/v1/**`, 13 pages, 20 test files
with 108 passing tests, a design-token UI, a money primitive library in integer minor units, and a
payment webhook verifier. `grep -rn "Not implemented" src` returns **zero** results.

The documentation is 4+ commits out of date and wrong in the same direction everywhere:

| Document | Claim | Reality |
|---|---|---|
| `README.md:14-22` | "**no working product**… no payment integration, no database query against real data, no authentication implementation, no loyalty maths, no settlement maths, no stock deduction, no dashboard implementation" | all six are implemented; 0 `Not implemented` in `src/` |
| `TASKS.md:3-4` | "**no task may be implemented yet**… the skeleton throws `Not implemented: T-XXX-XXX`" | nothing throws |
| `ROADMAP.md:3` | "Phase 0 (plan; **do not execute**)" | 19 slices executed |
| `SECURITY.md:4` | "no auth, no crypto, no hardening implemented" | `src/server/auth/port.ts` implements `AuthPort` + an 8-role permission matrix |
| `IMPLEMENTATION_STATUS.md:38` | "VS-0..VS-18 **fully**" | unverifiable, and the same file at line 13 retracts its own 68/70 claim |

## 2. Gate status (measured, not claimed)

| Gate | Command | Exit | Note |
|---|---|---:|---|
| install | `npm install --legacy-peer-deps` | 0 | `git ls-files package-lock.json` returns **nothing** — no lockfile is committed, so installs are not reproducible. A bare `npm install` also fails `ERESOLVE` on a peer conflict. |
| typecheck | `npm run typecheck` | 0 | |
| lint | `npm run lint` | 0 | the only project in the workspace with a green lint |
| build | `npm run build` | 0 | |
| test | `npm test` | 0 | 20 files, **108 passed**, 0 failed |
| docs gate | `npm run check:docs` | 0 | 105 markdown files, 38 ADRs |
| stub gate | `npm run check:stubs` | **1** | the project's own gate is red: it demands `NotImplemented` stubs and PHASE 0 markers that wave-2 deleted |
| census | `npm run census` | **1** | `IMPLEMENTATION_STATUS.md -> NFR-SEC-021` does not exist in `PRD.md` |

Two of this project's own gates are red. `package.json` exposes them as `check:stubs` and `census`,
but `.github/workflows/project-checks.yml` runs only `typecheck`, `test`, `build` for this project.

## 3. Persistence reality

| Concern | Reality |
|---|---|
| All business state | `LOCAL_FILE` — `src/server/db/memory-store.ts` (44 importers) persists to `data/db.json` via atomic `writeFileSync` + `renameSync`. **Verified surviving a hard kill.** An earlier draft of this audit said `IN_MEMORY` with no persistence; that was wrong. |
| Transactions | **None.** `src/server/db/repository.ts:21`: `export async function withTransaction<T>(fn) { return fn({}); }` with the comment *"In-memory: no real transaction… For Postgres, this would be a real transaction."* |
| Drizzle schema | `src/server/db/schema.ts` defines real `pgTable` definitions — **never used at runtime** |
| `pg` dependency | declared, unused |
| Restart | state survives — `data/db.json`. But `GET /api/v1/incidents` returns an empty body, so the pilot cannot read its own surviving data back |

`IMPLEMENTATION_STATUS.md:40` ("Modules Completed") does not list the absence of a database or a
transaction as a boundary. This is the single most consequential undocumented fact in the project.

## 4. Security reality

### GAP-P0-SIO-01 — unauthenticated write in production (verified)

`src/server/auth/port.ts:44-52`:

```ts
if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") {
  throw new Error("Fake auth must not be enabled in production");
}
const role = (process.env.FAKE_AUTH_ROLE as Role) || "HQ_OPS";
```

The guard fires only when the opt-in flag is **on**. Production default (`ALLOW_FAKE_AUTH` unset)
falls through and returns a privileged session. `resolveSession()` is called by 78 route handlers;
`if (!session) return 401` is therefore unreachable in practice.

**Verified** on a production build (`NODE_ENV=production`, `npm start`, commit `8ebc15f`):

```
GET  /api/v1/sales?limit=5                        (no cookie)  → 200 {"data":[],"pagination":{"limit":5}}
GET  /api/v1/audit?limit=3                        (no cookie)  → 200, returns audit rows
POST /api/v1/incidents  (no cookie, no Idempotency-Key)      → 201 {"incidentId":"c92872d7-…","status":"REPORTED"}
```

The created row is persisted into the audit chain with
`actorId: "00000000-0000-7000-0000-000000000002"` — the hardcoded fake user — and **survives to disk**:
the probe left an 17.8 KB `data/db.json` in the project root, containing the attacker's incident and
the audit rows it produced. Raw capture:
[`../evidence/siomayops-unauth.txt`](../../evidence/siomayops-unauth.txt).
(That artefact was removed after the capture so the working tree stays unmodified.)

An unauthenticated internet client can create business records and read the audit log. This is not a
documentation problem; it is a production incident waiting to happen.

### Idempotency is opt-in and silently skipped

`src/app/api/v1/_helpers.ts:47-56`: `if (!idempotencyKey) { …just execute… }`. A mutating route
called without the header performs the write anyway. `T-SALE-001` and ADR-0015 require idempotency on
money-moving operations.

### Correct: the payment webhook

`src/server/payments/webhook-verifier.ts:27-43` requires `PAYMENT_WEBHOOK_SECRET`, validates a
64-hex signature, compares with `crypto.timingSafeEqual`, and returns `REJECTED` for missing secret,
malformed body, or missing identifiers. QRIS cannot reach `PAID` without verified settlement
(`src/modules/checkout/service.py:105-106` in the sibling project; here
`verifyPaymentViaCallback` receives `signatureValid: true` only after verification passed). This is
the best-implemented security surface in the workspace and should be the template.

### Correct: no production data in the repo

`.env.example` is placeholders only; `PAYMENT_PROVIDER=none`; no credential is committed.

## 5. Tests that execute

108 pass, 0 fail. 20 files. `tests/e2e/*.spec.ts` (3 files) are **not real E2E**: they destructure
`page` from Playwright and never navigate — e.g. `expect(tapsForCashSale).toBeLessThanOrEqual(4)` over
a locally-declared constant. `IMPLEMENTATION_STATUS.md:13` correctly retracts these as E2E; the files
remain, and `package.json` still advertises `test:e2e`.

There is **no test** asserting that an unauthenticated request is rejected — which is why GAP-P0-SIO-01
survived to `main`.

## 6. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-SIO-001…006. Summary:

| Journey | Reality |
|---|---|
| UJ-SIO-001 start shift → open cash | works in-memory, dies on restart |
| UJ-SIO-002 record a cash sale, correct change | works in-memory; idempotency skippable |
| UJ-SIO-003 receive digital payment | webhook verification real; provider settlement absent by design |
| UJ-SIO-004 HQ reviews today's coverage | page + 8 routes work; reads memory store |
| UJ-SIO-005 report + close the day, reconcile variance | works in-memory; closing idempotent |
| UJ-SIO-006 operator authenticates | **does not exist**. GAP-P0-SIO-01 |

## 7. What is needed for a real user to do the core job safely

1. Real session resolution (replace `createAuthPort` with a real provider; fail closed).
2. A real database for money state, with real transactions.
3. Migrations actually applied on deploy, and the app refusing to start if the schema is behind.
4. Idempotency required, not optional, on money routes.
5. Then, and only then, the core journeys become `MVP_USABLE`.

## 8. Evidence IDs

| ID | command | result |
|---|---|---|
| EV-SIO-01 | `npm start` + `curl -X POST localhost:3200/api/v1/incidents` | `201` unauthenticated |
| EV-SIO-02 | `npm test` | 108 pass / 0 fail |
| EV-SIO-03 | `npm run check:stubs` | exit 1 |
| EV-SIO-04 | `npm run census` | exit 1 |
| EV-SIO-05 | `git ls-files package-lock.json` | no output — the lockfile is untracked |
