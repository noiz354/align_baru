# Test Data and Fixtures

**Document ID:** DOC-TESTING-FIXTURES
**Status:** Phase 0 specification (no fixture code exists; `tests/**` holds TODO suites only)
**Related:** `TESTING.md` §5, ADR-0023, `PRIVACY.md`, `QA.md`

---

## 1. Principles

1. **Synthetic only.** No production data ever enters a test environment, a screenshot, a fixture file
   or a bug report — not even masked (PRIVACY.md, RETENTION.md).
2. **Deterministic.** Every fixture has fixed ids and a frozen clock; randomness is seeded and the seed
   is printed on failure.
3. **Realistic shapes, fake content.** Numbers that exercise real arithmetic (change, rounding,
   allocation, variance) and names/locations that are obviously fictional.
4. **Money is integer minor units everywhere**, including fixtures; a float in a fixture is a defect.
5. **Time is injected.** Business-day edge cases (23:59, 00:05, 03:59, 04:01) come from clock control,
   never from sleeping in tests.

## 2. Fixture building blocks (planned)

| Fixture | Shape | Used by |
| --- | --- | --- |
| `organization(overrides)` | One pilot organisation | everything |
| `area(overrides)` / `sellingPoint(overrides)` | 2 areas, 6 selling points (one `RESTRICTED`, one dormant) | location, coverage, HQ |
| `stall(overrides)` | 5 stalls incl. one in `MAINTENANCE` | shift start, incidents |
| `operator(overrides)` | 6 operators: ACTIVE, SUSPENDED, TRAINEE_ACCOMPANIED, offboarded-with-history | authorization, shifts, recognition |
| `assignment(overrides)` | PRIMARY, RELIEF, TEMPORARY with windows | shift start conflicts |
| `menu(overrides)` | 6 items incl. a package and a retired item (content from configuration, never code) | sales, pricing |
| `pricePolicy(overrides)` | ORG/AREA/LOCATION policies incl. a deliberate ambiguity case | pricing resolution |
| `shift(overrides)` | OPEN, SUSPENDED, PENDING_SYNC, CLOSED_ACCEPTED, CLOSED_RETURNED | closing, reporting |
| `sale(overrides)` | cash sale, static-QRIS `PENDING_VERIFICATION`, voided sale, corrected sale | sales, payments, HQ |
| `expense(overrides)` | one per review state, incl. `UNVERIFIED_FIELD_EXPENSE` with no recipient fields | expense review |
| `stockMovement(overrides)` | issue, waste, sample, staff meal, `UNKNOWN` variance, `UNCOUNTED` count | derivation, variance |
| `incident(overrides)` | LOW…CRITICAL with/without evidence | incident lifecycle |
| `loyaltyAccount(overrides)` | consented, consent-withdrawn, expired reward, already-redeemed reward | loyalty |
| `fakeProvider(script)` | Scripted `PaymentProvider`: verified callback, duplicate, signature-invalid, amount mismatch, timeout | payment tests only |

## 3. Scenarios that must exist as fixtures

| Scenario | Why it exists |
| --- | --- |
| Full offline day (shift + 20 sales + 3 expenses + count + closing) | The core promise (AC-02) |
| Wrong device clock (device says 03:59, server says 04:01) | Business-day boundary |
| Duplicate replay of a sale and of a closing | Idempotency (INV-15) |
| Two devices starting the same stall's shift | Conflict handling (INV-03/04) |
| Static QRIS recorded, never verified | The honest waiting state |
| Callback arriving after expiry | Reconciliation path, never silent `PAID` |
| Reward redemption raced from two devices | Single-use constraint (INV-07) |
| Stock `UNKNOWN` variance at the tolerance boundary | Neutral variance handling |
| Offboarded operator with open variance | History preservation, no erasure |
| Cross-tenant read attempt | Authorization sweep (INV-14) |

## 4. Provider and network simulation

- **Payments:** only a fake adapter implementing `PaymentProvider` with scripted outcomes. A real
  gateway is never used in tests, and the fake must be impossible to enable in production.
- **Network:** Playwright `context.setOffline(true)` plus a fault harness in browser mode (latency,
  drop at 90%, corrupt response) to exercise the outbox.
- **Storage:** a local MinIO instance or a stubbed presign service; evidence in fixtures is a tiny
  generated image, never a real photograph of a person.
- **Jobs:** the queue runs against the same test database; tests assert job outcomes, not timing.

## 5. Cleanup and isolation

Each integration test runs in a transaction or against a schema created for the run, then rolled back
or dropped. Browser tests start from a fresh IndexedDB profile. No test depends on another test's
writes, and no test leaves a job scheduled that could fire during another run.

## 6. Prohibited in fixtures

Real names, real phone numbers, real photographs, real GPS coordinates of real locations, real customer
identifiers, production exports, screenshots of production screens, and any fixture that would make an
unverified payment look verified.
