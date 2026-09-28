# Parking Attendant Wave3 BASELINE

**Wave2 State:** `MVP_READY` (df0e396). Reproduced existing `demo.py` operator flow: check-in motor + vehicle condition/evidence → ticket → check-out cash → slot release → lost ticket/incident → shift close/reconciliation. Standard 2-hour motorcycle checkout fee Rp3.000; existing suite pass before this task. SQLite local-first schema migration v1; checkout changes session/slot/shift/outbox and audit.

**Hardening target:** checkout and cash payment represented by a single call with no stable payment/receipt rows. Sequential duplicate checkout was rejected only after state changed, but two concurrent `CheckOutUseCase` calls could both load the `ACTIVE` session before either persisted `CHECKED_OUT`.

**Pre-fix reproduction (real file-backed SQLite; two independent connections + barrier after both read ACTIVE):** same parked vehicle, both `execute(..., "CASH")` calls succeeded; one session became `CHECKED_OUT` with one fee Rp3.000, but shift cash increased **Rp6.000**, two checkout side effects could be emitted, and no durable one-payment/one-receipt entities existed. Test DB was a disposable `/tmp` file and removed after measurement.

**Wave3 target:** one atomic checkout transaction `BEGIN IMMEDIATE` → same replay returns existing checkout → single logical payment/receipt with unique `session_id` → one slot/session/shift/outbox/audit effect; duplicate payment retry returns same IDs; restart/reopen preserves state; reconciliation exact; hash-chain audit valid. Keep readiness `MVP_READY` with hardening, no broad feature.
