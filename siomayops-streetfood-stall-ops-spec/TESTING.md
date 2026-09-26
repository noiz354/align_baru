# TESTING

**Document ID:** DOC-TESTING
**Status:** Phase 0 (strategy + **TODO-only test skeletons**)
**Related:** ADR-0023, `QA.md`, `docs/testing/*`, NFR-PERF/OFFLINE/SEC

---

## 1. Testing problem statement

This system has four properties that make ordinary "write unit tests" advice insufficient:

1. **Money must be exact.** A rounding bug or a double-count is worse than a crash.
2. **The primary client is offline-first.** Most bugs will live in sync, retries, and conflict
   handling — not in happy-path rendering.
3. **Adversarial surfaces are real.** Payments, expenses, and cash closings attract fraud.
4. **The primary environment cannot be simulated fully** (gloves, sunlight, noise, 3G).

Therefore the test pyramid is inverted in effort: **integration and browser tests carry the
weight**, supported by fast unit tests for pure rules, and finished by manual field QA.

---

## 2. Toolchain (ADR-0023)

| Layer | Tool | Why |
| --- | --- | --- |
| Unit | **Vitest 4** | Fast, ESM-native, shared config with Vite/Next tooling |
| Component / DOM-behaviour | **Vitest Browser Mode** (Playwright provider, stable since Vitest 4) | Real layout, real focus/pointer behaviour, visual regression, Playwright traces |
| Integration (DB, repos, jobs) | Vitest + real PostgreSQL (docker service in CI), transactions rolled back per test | Constraint-level truth (unique indexes, partial indexes) |
| E2E journeys | **Playwright** (Chromium device emulation: 360×640 Android-class, plus desktop for HQ) | Mirrors the real user environment; offline simulation; trace viewer |
| Accessibility checks | Automated contrast/size assertions + manual checklist | See `ACCESSIBILITY.md` §5 |
| Load (later) | k6 or similar, run per slice for money paths | Validate NFR-PERF-003 |
| Contracts | Zod schemas shared client/server; tests assert schema/route agreement | Prevent drift |

**Explicitly rejected:** Jest (slower, no real-browser mode), Cypress (heavier, weaker parallel
story in 2026), Enzyme-era shallow rendering (meaningless for behaviour).

---

## 3. Test taxonomy and what belongs where

| Layer | Tests | Must not contain |
| --- | --- | --- |
| Unit (`tests/unit`) | Money arithmetic, price resolution order, state machine guards, business-day derivation, variance maths, permission matrix logic, formatters | I/O, DB, network |
| Integration (`tests/integration`) | Repository behaviour with real Postgres, constraints/invariants (unique partial indexes), idempotency records, transaction boundaries, job handlers, webhook verification | UI |
| Browser (`tests/browser`) | Component behaviour, form interactions, offline banners, queue UI, tap-target sizes, keyboard nav, visual regression of key screens | Business rules duplication |
| E2E (`tests/e2e`) | Full journeys per vertical slice (shift start → sale → expense → closing), offline→online sync, cross-role permission denial, HQ dashboard cards | Exhaustive edge coverage (too slow) |

**Rule:** every invariant in `DOMAIN.md` §4 must have at least one integration test that proves
it at the database/constraint level, and one at the use-case level.

---

## 4. Required test suites by domain (planned, all TODO in Phase 0)

### 4.1 Money & pricing
- Historical price preserved after HQ changes current price (snapshot immutability).
- Price resolution order: LOCATION beats AREA beats ORG; newest effectiveFrom wins.
- Ambiguous resolution blocks the sale with a clear error.
- Override expiry: after expiry, base price applies; before, override applies.
- Discount rounding: half-up to nearest rupiah, computed once.
- Total recomputation equals stored total for a historical sale.

### 4.2 Sales & payments
- Duplicate sale submission (same client id) creates exactly one sale.
- Two devices, same client id: one canonical record; both converge.
- Cash change computed server-side; underpayment rejected.
- Client-supplied price mismatch ⇒ `409 STALE_DATA`, sale not silently repriced.
- Offline cash sale replay after reconnect: counted once.
- Digital payment with no verified evidence can never reach PAID.
- Provider callback: invalid signature ⇒ rejected + audit; valid ⇒ processed once.
- Duplicate callback ⇒ idempotent, no double total.
- Late callback after `EXPIRED` ⇒ explicit reconciliation path, never silent PAID.
- Amount mismatch ⇒ review queue.

### 4.3 Offline & sync
- Start shift offline, then sync: accepted once, correct business day.
- Closing submitted offline stays `PENDING_SYNC` and editable until accepted.
- Digital payment is never reported successful while offline.
- Corrupted queue entry is quarantined, not dropped.
- Stale price (> hard limit) blocks sale with an actionable message.
- Sync batch with out-of-order dependencies is applied in dependency order or deferred whole.

### 4.4 Expenses & review
- Expense submission idempotent per client id.
- Flagging requires a reason; rejection requires a reason; nothing deletes.
- `UNVERIFIED_FIELD_EXPENSE` is recorded neutrally (no recipient or purpose fields exist).
- Review transitions are monotonic; illegal transitions throw.
- Rejected expense remains visible to operator and in shift reporting history.

### 4.5 Stock
- Position derived from movements; duplicate movement idempotent.
- Variance requires a reason beyond tolerance; `UNKNOWN` is accepted.
- No code path auto-accuses: variance never changes operator status or triggers a sanction.
- Transfer states enforced; receiving more than issued requires a discrepancy record.

### 4.6 Closing & settlement
- Expected cash computed as opening + cash sales − cash expenses.
- Out-of-tolerance variance blocks acceptance without a reason.
- Accepted closing is immutable; correction is a new audited record.
- Late sale after closing surfaces as an exception, not a silent rewrite.
- Digital verified vs unverified amounts are never merged in any output.

### 4.7 Loyalty
- Reward cannot be redeemed twice (unique constraint, concurrent attempts).
- Earn is idempotent per sale.
- Consent enforced: no account without explicit opt-in.
- Deletion request removes/anonymises customer data while preserving sale totals.

### 4.8 Security & authorization
- Cross-operator access denied for every route (IDOR sweep).
- Role + scope combined enforcement (e.g. Finance cannot start a shift for an operator).
- Privileged actions require reasons and emit audit events.
- Export without permission denied; permitted export is audited.
- No route accepts a client-declared payment success.

### 4.9 Performance & UX
- Operator bundle budget (JS ≤ 250 KB gzip) asserted in build.
- 360 px viewport: no horizontal scroll on key screens.
- Tap targets ≥ 48 px (≥ 64 px monetary) asserted.
- Contrast tokens pass AA in both normal and sunlight modes.
- HQ card render within budget at seeded 2,000-stall dataset.

---

## 5. Test data strategy

| Need | Approach |
| --- | --- |
| Deterministic fixtures | Factories with fixed IDs and timestamps; no randomness without a seed |
| Clock control | Injected clock port; tests freeze/unfreeze time (business-day edge cases) |
| Money edge cases | Boundaries: 0, 1, large values, exact change, rounding boundaries |
| Offline simulation | Playwright `context.setOffline(true)` and a network-fault harness in browser mode |
| Provider simulation | A fake adapter implementing `PaymentProvider` with scripted outcomes (verified callback, duplicate, mismatch, timeout) — **never** a real gateway in tests |
| Large-scale data | A seeding script for performance tests (2,000 stalls, 60k sales/day shape) |
| Personal data | Synthetic only; no production data in test environments, ever |

---

## 6. CI pipeline (planned, VS-0/VS-19)

```text
lint → typecheck → unit → integration (Postgres service) → build (bundle budget)
     → browser tests → e2e (against preview deploy) → a11y checks
     → migration dry-run → container build + scan → deploy (on main)
```

| Rule | Detail |
| --- | --- |
| Gate | No merge with failing tests or a bundle-budget breach |
| Speed | Unit+integration ≤ 5 min; browser ≤ 8 min; e2e ≤ 12 min (parallelised) |
| Flakes | Quarantine with an issue; a flaky money test is fixed before anything else ships |
| Migrations | Run forward and backward on a production-shaped copy in staging before production |
| Coverage | Not a target number; coverage of **invariants and money paths** is |

---

## 7. What "done" means for a test suite here

A feature is not done until:

1. Its invariants are proven at the database level (constraints), not just in code.
2. Its offline path is tested with real disconnection.
3. Its idempotency is tested by replaying the exact request.
4. Its authorization is tested from an out-of-scope actor.
5. Its failure modes produce honest UI states (tested, not assumed).
6. Its audit event exists and contains actor + reason where required.

---

## 8. Phase-0 test skeletons

All test files in `tests/` contain **TODO-only** cases, e.g.:

```ts
describe.todo("preserves historical item price after HQ changes current price");
describe.todo("does not accept duplicate payment provider callbacks twice");
describe.todo("supports cash sale while temporarily offline");
describe.todo("does not report an offline digital payment as successful");
describe.todo("detects shift cash variance without silently changing sales");
describe.todo("prevents loyalty reward from being redeemed twice");
describe.todo("normalizes operator recognition for different operating conditions");
```

No test asserts real behaviour yet, because no behaviour exists.
