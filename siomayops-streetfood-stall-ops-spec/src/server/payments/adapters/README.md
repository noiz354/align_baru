# Payment adapters — intentionally absent

This folder exists so that provider-specific code has one obvious home when the work starts
(`T-PAY-001`, VS-6/VS-17). **No adapter may be written before then.**

Rules that will apply:

1. `PaymentProvider` (see `../provider.ts`) is the only surface the domain and features see.
2. Signature verification, reference matching, amount matching and replay protection live inside
   the adapter, and the adapter may only ever return *verified* evidence (`WebhookVerifier`).
3. Amounts are converted from provider decimal strings to integer minor units **at this edge only**
   (ADR-0006). A provider decimal string must never reach domain code.
4. Provider secrets come from server-side secret storage and never touch the client bundle, logs,
   evidence images or error payloads (NFR-SEC-004).
5. Mock/sandbox adapters must be impossible to enable in production, and must not be able to move a
   payment to `PAID` (the point of ADR-0033 is that a simulation is never evidence).
6. QRIS specifics (static vs dynamic, `pointOfInitiationMethod`, partner reference numbers,
   settlement timing) are documented in `docs/payments/QRIS.md`.
