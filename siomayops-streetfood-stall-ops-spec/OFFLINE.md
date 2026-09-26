# OFFLINE

**Document ID:** DOC-OFFLINE
**Status:** Phase 0 (specification; **no offline engine implemented**)
**Related:** NFR-OFFLINE-*, ADR-0017, API.md §17, `SALES.md`, `SETTLEMENT.md`

---

## 1. Reality check

Jakarta field conditions include: dead zones under flyovers, congested cells in markets,
phones on 2G fallback, prepaid data running out mid-shift, and batteries dying before closing.
The platform must **assume disconnection is normal**, not exceptional.

The core promise: **an operator can run an entire shift offline, and the books will still be
correct when the connection returns.**

---

## 2. What must work offline (and what must not)

| Capability | Offline? | Notes |
| --- | --- | --- |
| Start shift | ✅ | Local record; server may reject later on conflict (clear reason shown) |
| Confirm stall / location | ✅ | From cached data or free-text note |
| Change location | ✅ | Queued with device timestamp; reason captured offline |
| Confirm starting stock | ✅ | Cached items; server recomputes expectations later |
| View local prices | ✅ | Cached with freshness marker; stale ⇒ confirm-before-sell |
| Cash sale | ✅ | Canonical offline path |
| Repeat last sale | ✅ | Local history |
| Record expense | ✅ | Queued; reduces expected cash locally (marked pending) |
| Stock update / count | ✅ | Queued; reason fields work offline |
| Restock request | ✅ | Queued with urgency |
| Submit incident | ✅ | Queued; P1 flagged as delayed sync on arrival |
| Closing submission | ✅ (special) | `PENDING_SYNC`, **still editable**, not "closed" until accepted |
| **Digital payment creation/verification** | ❌ | Must never be marked successful offline |
| **Loyalty identify / redeem (default)** | ❌ | Requires server (fraud/consent enforcement) |
| Price publication / acknowledgement validity | ❌ | Acknowledgement is digest-bound to server state |
| Void / correction of a COMPLETED sale | ❌ (requests only) | Requires permission + audit online |

---

## 3. Local architecture (concept)

```text
┌──────────────────────────── Device ────────────────────────────┐
│  App shell (cached by service worker)                          │
│                                                                │
│  Reference cache:  menu · prices(+freshness) · locations ·     │
│                    stock items · my assignments                │
│                                                                │
│  Outbox queue (IndexedDB): ordered per aggregate               │
│    { localId, aggregate, type, payload, createdAt, attempts,   │
│      lastError, state }                                        │
│                                                                │
│  Local mirror: my open shift · my sales today · my expenses    │
│    (for UI continuity and quick totals — server remains truth) │
└────────────────────────────────────────────────────────────────┘
```

Storage choice: IndexedDB (structured, transactional, available in all target browsers). No
SQLite-in-the-browser dependency; if a deployment ever ships a native wrapper, the outbox
contract stays identical.

---

## 4. Identity and idempotency

| Mechanism | Rule |
| --- | --- |
| Local ID | UUIDv7 generated on device (`clientSaleId`, `clientExpenseId`, `clientShiftId`, …) |
| Server ID | Assigned on acceptance; the client keeps both and displays nothing about them |
| Idempotency key | `Idempotency-Key: <clientId>` on every replayed request |
| Uniqueness | `(organization_id, client_*_id)` unique constraints in the database |
| Replay semantics | Server returns the original record, marked `idempotentReplay: true` |
| Conflict with different payload | `IDEMPOTENCY_MISMATCH` — surfaced to the user/service desk, never merged |

**Why client IDs are permanent aliases:** they let support reconstruct exactly what happened on
a device, and they make reconciliation of half-synced shifts possible.

---

## 5. Ordering and causality

| Aspect | Rule |
| --- | --- |
| Per-aggregate order | Strict FIFO per aggregate (a shift's records sync in creation order) |
| Cross-aggregate order | Not guaranteed; the server derives dependencies (e.g. a sale references a shift that must exist locally) |
| Server authority | The server may accept in a different order than created, but records keep their device timestamps |
| Dependencies | If a sync batch contains a dependency the server lacks (sale before shift), the batch is applied in dependency order inside one transaction, or the whole batch is deferred with a clear reason |
| Time skew | Device clock drift is bounded; records beyond the bound are flagged, not silently adjusted |

---

## 6. Sync protocol (concept)

```text
1. Detect connectivity (online event + periodic lightweight probe; never a battery-draining loop)
2. Send batch: POST /api/v1/sync/batches { deviceId, records: [{aggregate, type, clientId, payload, createdAt}] }
3. Server processes idempotently, returns per-record results:
   { clientId, status: ACCEPTED | DUPLICATE | REJECTED | DEFERRED, serverId?, reason? }
4. Client marks records:
   ACCEPTED → "terkirim" (keep serverId)
   DUPLICATE → "terkirim" (canonical record adopted)
   REJECTED → needs user action (specific, plain-language reason + fix path)
   DEFERRED → retry later with backoff
5. Failed batch → exponential backoff (5s → 15s → 1m → 5m → 15m, cap), preserving order
```

Batch size is bounded (e.g. ≤ 100 records or ≤ 256 KB) so a bad connection still makes progress.
Nothing in the sync path is fire-and-forget.

---

## 7. Conflict handling

| Conflict | Detection | Resolution |
| --- | --- | --- |
| Shift already started elsewhere (same operator/stall) | Unique partial index | Server rejects the queued start; operator sees which device/shift won; no duplicate shift |
| Same sale submitted twice | `client_sale_id` unique | Idempotent: one sale; both clients converge |
| Price changed while offline | Server price ≠ device snapshot at acceptance | Server returns `409 STALE_DATA` with new price; operator confirms; the sale is created at the confirmed price with a note recording the mismatch |
| Location changed offline then HQ also changed assignment | Report vs assignment disagree | Report wins (it is ground truth); HQ sees both; advisory notice |
| Closing submitted, then more sales found on device | Dependency check (open sales for the shift) | Closing marked `incomplete`; the operator is asked to add the missing sales or to explain (a "late sale" is recorded with HQ visibility) |
| Expense submitted twice after reconnect | `client_expense_id` unique | Idempotent |
| Two devices, same operator, both record sales | Allowed | Both sync; totals remain correct because sales are additive and independent |
| Stock movement duplicated | `client_movement_id` unique | Idempotent; position derived once |
| Loyalty redemption attempted offline | Policy | Refused with a clear message; no queued redemption by default |

**Principle:** never silently pick a winner when money is involved. Either the outcome is
unambiguous (idempotent) or a human sees it.

---

## 8. Stale data rules

| Cached thing | Staleness limit | Behaviour when stale |
| --- | --- | --- |
| Prices | 24 h soft / 7 days hard | Soft: amber marker, still sellable with confirmation. Hard: block selling for unpriced items and prompt "connect to update prices" |
| Menu availability | 24 h | Show items, mark availability "belum diperbarui" |
| Locations list | 7 days | Allow free-text location note as fallback |
| Stock item catalog | 7 days | Allow counting against cached items; unknown items become "Lainnya" notes to HQ |
| Assignments | 24 h | Warn operator; do not block (operators know their own day better than the cache) |
| Shift context | Always local | Never stale (it is the device's own record) |

**Hard rule:** the client never invents a price. If the price is unknown or hard-stale, the
operator is told to connect, or HQ is asked, but no guess is recorded (NFR-OFFLINE-010).

---

## 9. Reliability of the queue

| Concern | Mitigation |
| --- | --- |
| Browser/tab closed | Outbox persists in IndexedDB; reopened app resumes |
| Battery dies | Records already written to IndexedDB; nothing is lost mid-typing because the sale is committed on "Bayar" |
| Storage pressure | Outbox entries are minimal (IDs, amounts, small payloads); photos are queued separately with size caps |
| Queue corruption | Entries are individually validated on read; a corrupt record is quarantined and exported for support, **never** dropped silently |
| Duplicate delivery after partial failure | Idempotency keys make replays safe |
| Clock changes | Server bounds accepted device times; anomalous times are flagged |
| App update mid-shift | Service worker update policy: never force-reload during an active shift; prompt after closing |
| Switching phones mid-shift | Shift can be resumed on another device after login; the outbox is device-local, so a documented transfer path exists (sync first, then switch) |

---

## 10. Server authority statement (invariant)

```text
The server is authoritative for:
  • price snapshots and price validity
  • payment states and money movement
  • shift lifecycle acceptance (start/close)
  • stock expectations and variance computation
  • loyalty issuance and redemption
  • permissions and scope

The device is authoritative only for:
  • the fact that an operator recorded something at a given device time
  • its own queue state and retry bookkeeping
```

Any design that lets the device decide a money state is rejected in review (see
`docs/architecture/FINAL-REVIEW.md`).
