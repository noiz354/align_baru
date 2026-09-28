# SiomayOps Wave3 FAILURE_CASES

## 1. Invalid callback signature cannot credit a payment

- **Input:** a QRIS callback with a valid-shaped payload but an incorrect HMAC.
- **Observed:** `SIGNATURE_INVALID`; payment does not transition to `PAID`.

## 2. Amount mismatch stays pending for review

- **Input:** a signed callback whose amount differs from the pending payment amount.
- **Observed:** `VALIDATION_FAILED`; payment remains pending and is not silently adjusted or credited.

## 3. Unknown reference does not credit a sale

- **Input:** correctly signed callback for an unknown provider reference.
- **Observed:** `NO_MATCH`; no payment is marked paid.

## 4. Replay is idempotent

- **Input:** resend a valid callback after its first successful application.
- **Observed:** first callback returns `PAID`; replay returns `DUPLICATE` and does not apply another payment transition.

## 5. Restart preserves both outcomes

- **Input:** restart the app after one payment is paid and another is pending.
- **Observed:** paid remains paid and pending remains pending after restart.

The Wave3 run also passed the broader 108-test suite, including idempotency and stock derivation checks. Runtime database and generated mockup images are not included.