# Parking Attendant Wave3 IMPLEMENTATION

**Narrow defect fix:** concurrent cash checkouts could double-add a shift fee. Harden only checkout/payment/reconciliation consistency.

## Changed files

- `src/modules/checkout/service.py` — public `execute()` now wraps session read + checkout mutation, durable payment/receipt rows, slot release, shift collection, outbox and audit call in the repository transaction with `immediate=True`. Identical replay for same finalized session + same attendant + same method returns the stored finalized `ParkingSession` without side effects. A different checkout on already-finalized stay conflicts; QRIS still fails before mutation unless an authenticated settlement flow is configured.

- `src/infra/sqlite_store.py` — nested transaction support via SQLite savepoints, outer `BEGIN IMMEDIATE` serializes separate SQLite connections before the session's ACTIVE-state read. Migration `2_checkout_idempotency_payments_receipts` adds session checkout/payment/receipt refs plus `checkout_payments` (`session_id UNIQUE`) and `receipts` (`session_id UNIQUE`, `payment_id UNIQUE`). `record_checkout_payment_receipt()` returns existing IDs for the same payment retry or rejects method/amount mismatch; `list_checkout_payments` / `list_receipts` provide audit/reconciliation queries. V1 remains untouched; schema v2 is additive/idempotent.

- `src/core/domain.py` — `ParkingSession` now round-trips `checkout_payment_method`, `payment_id`, and `receipt_id`.

- `src/infra/file_audit.py` — added `prev_hash` + SHA-256 `hash` per append-only JSONL record, recovery of sequence/hash tail on logger restart, `verify_chain()` with tamper detection, and re-chains after explicitly authorized plate anonymization. This gives checkout/audit evidence a verifiable chain.

- `tests/test_checkout_idempotency.py` — two independent file-backed SQLite connections issue concurrent same checkout; reopen DB/logger; repeat checkout/payment; verify one finalized session, one fee, one payment row, one receipt row, one outbox event, one CHECK_OUT audit, shift cash exactly once, reconciled balance zero, hash chain valid.

- `scripts/wave3_checkout_e2e.py` — repeatable standalone runtime test, writes DB/audit only to a temporary directory then deletes them.

- `tests/test_audit_retention.py` — restart/chain tamper test and chain remains valid after privacy plate masking.

## Invariants

- SQLite migration 1 baseline retained; migration 2 adds only fields/tables needed for exact-once checkout.
- `BEGIN IMMEDIATE` acquired before active-session lookup; nested repo writes savepoint under same atomic transaction.
- Unique database keys are durable backstops, not only process-local locks.
- Duplicate payment retry matches original method+amount; differing retry is rejected.
- `CHECK_OUT` / payment / receipt / slot free / shift cash / outbox all happen once.
- Demo QRIS still fail-closed (`verified provider settlement` required); no fake paid state introduced.

Implementation commit: `d498bc9 fix(parking): make checkout finalization idempotent`.
