# Data Flow

**Document ID:** DOC-ARCH-DATAFLOW
**Status:** Phase 0 specification (no flow is implemented; every entry point throws NotImplemented)
**Related:** `ARCHITECTURE.md` §6–§9, `EVENTS.md`, `OFFLINE.md`, `API.md`, `DATA_MODEL.md`

---

## 1. The four flows that matter

| # | Flow | Direction | Authority | Failure behaviour |
| --- | --- | --- | --- | --- |
| F1 | Real-time operator write (online) | device → API → Postgres | Server (prices, states, ids) | Fail loudly; nothing partially applied |
| F2 | Offline replay | device outbox → `/sync/batches` → Postgres | Server, per record | Per-record results; quarantine, never drop |
| F3 | Provider callback / verification | provider → webhook → Postgres | Server, after verification | Reject + audit + alert; never apply unverified |
| F4 | Reporting read | job → read model → HQ/API | Read model with freshness | Stale labelled; drilling goes to source records |

## 2. F1 — Operator write path

```text
UI (optimistic UI, local ids)
  → POST /api/v1/... (Idempotency-Key, If-Match where versioned)
    → Zod validation (src/shared/contracts)
    → SessionContext + authorize(action, subject, scope)      [denial ⇒ 403 + audit]
    → use case (src/features/...): load state, apply domain rules (src/domain/...)
      → repository (scope-mandatory) inside one transaction:
           business rows + audit row + outbox/domain event + idempotency record
    → response with the authoritative record (and `idempotentReplay` when applicable)
UI replaces the optimistic value with the server value, or shows the conflict
```

Rules: server time governs ordering and the business day; prices are resolved server-side and stored
as snapshots; cash payments may be created offline (F2), digital payments may not (ADR-0033); an audit
row and the business change commit together (INV-10) or the whole operation fails.

## 3. F2 — Offline replay path

```text
device: IndexedDB outbox (encrypted), per-aggregate FIFO
  shift → location_report → sale(payment_cash) → expense → stock_report → incident → closing
  each record: clientId (UUIDv7), sequence, recordedAtDevice (metadata only), syncState
  → POST /api/v1/sync/batches {deviceId, appVersion, records[]}
      per record: dedupe by (org, clientId) → authorize → validate → apply or defer
      → { outcome: ACCEPTED | DUPLICATE | REJECTED(reason) | DEFERRED(retryAfter) }
  device: update syncState, keep REJECTED visible to the operator forever
```

Conflict policy (detail in `OFFLINE.md`): shift already closed by another device ⇒ reject with an
explanation; closing already accepted ⇒ duplicate; digital payment presented as PAID ⇒ rejected as an
invalid transition and audited; out-of-order dependency ⇒ defer the dependent record. Quarantine is a
human queue, never a silent drop (NFR-OFFLINE-005/007).

## 4. F3 — Payment verification path

```text
(a) dynamic QRIS (future slice):
    POST /api/v1/payments/digital → provider.createPayment → payment PENDING (+ attempt row)
    provider → POST /api/v1/webhooks/payments/{provider}
        verify: signature → partner reference → amount/currency → replay guard
        matched & verified → transaction: attempt PAID + evidence + audit + alert resolution
        unmatched/invalid  → audit + security alert (never applied)

(b) static QRIS (pilot):
    operator records the claim → PENDING_VERIFICATION
    HQ Finance verification queue → reconciliation record (outcome, reason, evidence note)
        → transaction: payment PAID + reconciliation + audit
    sweep job: payments pending beyond SLA → alert to Finance
```

Invariants: no client path reaches PAID (INV-06); the only evidence sources are a verified callback, a
verified status query, or a recorded reconciliation; verified and unverified amounts stay separate in
every projection (FR-PAYMENT-010).

## 5. F4 — Reporting path

```text
operational tables (shifts, sales, payments, expenses, stock movements, closings, incidents)
  → scheduled jobs (pg-boss) build read models every 60 s – 15 min
      each row: organization_id, scope, computedAt, sourceWatermark, value
  → read endpoints / cards serve stored values + freshness band
  → drill-down uses the underlying record endpoints (scope-checked)
```

Nothing heavy is computed on a page load; a stale card is dimmed and labelled, never silently
presented as current (FR-HQ-008). Money decisions are never taken from a read model.

## 6. Data classification along the flows

| Data | Sensitivity | Treatment in flight | At rest |
| --- | --- | --- | --- |
| Sales, payments, expenses | Financial | TLS; idempotency keys; no logging of amounts in plain logs | Postgres, integer minor units, audit trail |
| Operator identity & phone | Personal | Masked in logs and in most surfaces; full number only for self/supervisor | Postgres with field-level masking; retention per `RETENTION.md` |
| Location reports | Personal (movement-adjacent) | Only shift-bounded reports; coordinates never logged | Coordinates purged after the retention window; aggregates remain |
| Customer loyalty reference | Personal (consented) | Never displayed to operators beyond the redemption context | Separate store from operator performance data; deletion pipeline |
| Evidence photos | Personal (possible bystanders) | Presigned upload/download, short-lived | Lifecycle-managed object storage, scheduled deletion |
| Audit rows | Internal, accountability | Written only by the audit helper | Append-only, UPDATE/DELETE revoked at the database level |

## 7. Flow-level invariants (testable)

1. No money figure exists without a record that produced it, and no record changes after acceptance.
2. No digital payment becomes PAID without verified evidence or a recorded reconciliation.
3. No location data exists for an inactive shift, and nothing collects position in the background.
4. No queued record disappears without a visible reason; nothing is applied twice.
5. No read surface presents a figure without its age and its verification status.
6. No flow exists whose effect is to make an irregular field payment easier, faster or invisible.
