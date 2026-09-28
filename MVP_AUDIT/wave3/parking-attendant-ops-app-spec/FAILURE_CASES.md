# Parking Attendant Wave3 FAILURE_CASES

## 1. Unverified QRIS payment cannot finalize or release stay

- **Input:** active parked motorcycle, 2 hours, `CheckOutUseCase.execute(session_id, "att1", "QRIS")` without provider-verified settlement.
- **Observed:** raises `ValueError("QRIS requires verified provider settlement before checkout")`; session stays `ACTIVE`, slot remains `OCCUPIED`, fee/payment/receipt absent, shift cash and QRIS collections remain 0. Existing test `test_qris_request_does_not_fake_payment_or_release_slot` passed after the new transaction work.
- **Why strongest:** payment honesty stays fail-closed while cash is now exactly-once; retries cannot manufacture a digital PAID.

## Idempotency/mismatch guard

- Same session/attendant/method replay after successful cash checkout returns the same `payment_id` and `receipt_id` without new writes.
- Different/unsupported checkout method does not create a second payment or receipt; database unique constraint is per `session_id`; payment method/amount mismatch in a duplicate persistence call is rejected.

## Audit chain corruption

- Tamper with a stored event's `details.fee`; `JsonAuditLogger.verify_chain()` detects `content hash mismatch`. Restart recovers sequence/hash tail; permitted plate anonymization recomputes links after privacy rewrite.
