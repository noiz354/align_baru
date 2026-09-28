# Parking Attendant Wave3 RUNTIME_PROOF

## Existing Wave2 flow reproduced

`python3 demo.py` passed its existing full flow (all generated files under `/tmp/parking_demo_*`): sample session `ses_3737ffdd5ffe` cash checkout 3 billable hours Rp4.000 → slot `A-03` freed; lost-ticket checkout Rp24.000; shift close cash system Rp28.000 + float Rp100.000, counted Rp128.000, variance Rp0 `BALANCED`; audit ledger 11 actions. Existing unit suite remained green.

## Pre-fix concurrency defect (captured before implementation)

File-backed `/tmp/parking-wave3-*.db`, two independent `SqliteParkingStore` connections synchronized so both read the same stay as `ACTIVE` before either writes:

- session `ses_7f9791ef7891`
- two concurrent checkout calls both succeeded
- one final session fee Rp3.000 and `CHECKED_OUT`
- shift cash became **Rp6.000** (duplicate side effect)
- no checkout payment/receipt tables existed; this did not meet one-payment/one-receipt.

The pre-fix database was removed after observation.

## Fixed runtime: duplicate + concurrent cash checkout/payment

Repro command: `python3 scripts/wave3_checkout_e2e.py`; it seeds a temporary SQLite DB/audit ledger, opens two independent connections concurrently, reopens them, replays checkout/payment, reconciles, then deletes temp data.

- `session_id`: **`ses_e40e810edd8d`**
- `concurrent_checkout_requests`: 2; `concurrent_successes`: 2 (same idempotent response); errors `[]`
- final `state`: `CHECKED_OUT`; single fee **Rp3.000**
- `payment_method`: `CASH`
- `payment_id`: **`pay_15fba139130d4ceca9d02b85c293ee2f`**; payment retry returned same id
- `receipt_id`: **`rcpt_592ac760fe1849a1b3c424823e0a238c`**; receipt retry returned same id
- `checkout_payments` rows for stay: **1**; `receipts`: **1**; `VehicleCheckedOut` outbox events: **1**
- check-out audit events: **1** (open shift/checkin + close shift are other actions)
- reopen SQLite + audit logger, send identical checkout and payment retries → no second side effects
- `shift_cash_before_reconcile`: Rp3.000
- `cash_expected_after_reconcile`: Rp103.000 (Rp100.000 opening float + Rp3.000 one fee)
- `cash_counted`: Rp103.000; `cash_variance`: Rp0 (balanced)
- audit after reconciliation: 4 events, `verify_chain() = true`, `audit_chain_issues=[]`

## Negative paths / unchanged honesty boundaries

- Existing test: QRIS `CheckOutUseCase.execute(...,"QRIS")` → `ValueError` `verified provider settlement`; stay remains `ACTIVE`, slot remains `OCCUPIED`, shift cash and QRIS collections remain zero (no fake paid transition).
- Different/unsupported payment method remains rejected before session/payment mutation; idempotent replay checks the same attendant and method.
- Audit tamper test modifies stored fee in the first JSONL record → `verify_chain() == false`; logger restart preserves tail and chain; privacy anonymization re-chains the authorized rewritten ledger and verifies.

## Regression tests

`python3 -m unittest discover -s tests` → **66 tests passed** (includes concurrent exact-once checkout/payment, reopen/replay/reconciliation, audit chain persistence/tamper and all existing vehicle/check-in/checkout/shift/ticket tests).

No runtime DB/audit/log data is committed; script uses disposable temporary paths only.
