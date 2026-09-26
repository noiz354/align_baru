# GLOSSARY

**Document ID:** DOC-GLOSSARY
**Status:** Phase 0
**Related:** `DOMAIN.md` (ubiquitous language), `docs/design/DESIGN-SYSTEM.md` (UI wording)

Terms are listed alphabetically. "Operator wording" is what appears in the field UI
(Bahasa Indonesia); "Domain term" is what the code and HQ use.

| Term (domain) | Operator wording | Definition |
| --- | --- | --- |
| **Area** | Area | Operational grouping of selling points with a supervisor; sits under a region. |
| **Assignment** | Penugasan | Planned pairing of an operator to a stall (and area) with a validity window. |
| **Audit event** | *(not shown)* | Immutable record of a critical state change: who, what, when, previous value, new value, reason. |
| **Business day** | Hari kerja | The accounting/operational day, derived in Asia/Jakarta with an explicit cut rule (a 00:40 sale belongs to the previous business day). |
| **Cash count** | Hitung uang | The operator's physical count of the cash box at closing. |
| **Cash variance** | Selisih | Difference between expected and counted cash; requires a reason beyond tolerance; never an accusation. |
| **Closing** | Setoran / Tutup hari | End-of-shift reconciliation submission: sales, expenses, cash, stock. |
| **Daily closing (HQ)** | — | Area/business-day aggregation, review, sign-off, and lock. |
| **Digital payment** | Pembayaran digital | Any non-cash method (QRIS, transfer, e-wallet, other approved). |
| **Dynamic QRIS** | — | Provider-generated QR per transaction with a fixed amount; supports callbacks and status queries. |
| **E-wallet** | Dompet digital | Wallet-based digital payment method (GoPay, OVO, DANA, ShopeePay, etc.); provider-dependent. |
| **Evidence** | Bukti | Optional photo/receipt attached to an expense, incident, or payment reconciliation; access-controlled and short-lived. |
| **Field expense** | Uang keluar | Any operational cost reported by an operator (parking, cleaning, transport, etc.). |
| **Handover** | Serah terima | Mid-shift transfer of an active stall from one operator to another, with counts and open issues recorded by both sides. |
| **Idempotency key** | *(not shown)* | Client-supplied unique key making a repeated request safe to replay without duplicating effects. |
| **Incident** | Kejadian | Reported operational problem (equipment, dispute, safety, theft, forced relocation…) with a lifecycle and severity. |
| **Issue (stock)** | Kirim barang | Warehouse/kitchen → operator transfer of stock. |
| **Location report** | Laporkan lokasi | Explicit, operator-initiated statement of where the stall is selling; exists only during an active shift. |
| **Loyalty account** | Kartu pelanggan | Optional customer record identified by phone hash, QR token, or anonymous device token, with recorded consent. |
| **Mangkal** | Mangkal | Indonesian term for the selling spot; the product's core location concept. |
| **Menu item** | Menu | A configurable sellable or component item; never hard-coded. |
| **Minor units** | *(not shown)* | Integer money representation. For IDR the minor unit is 1 rupiah (no circulating sen), so amounts are whole rupiah integers. |
| **Money** | *(not shown)* | Value object `{ amountMinor, currency }`; arithmetic is integer-only; never a float. |
| **Operational alert** | Peringatan | Actionable, resolvable domain object raised by a rule or job (distinct from infrastructure alerts). |
| **Operator** | Penjual | The person accountable for a stall's cash and stock during a shift. Not a "user" to be surveilled. |
| **Operator of the Day/Month/Year** | Penghargaan | Periodic recognition computed from multi-factor, normalised, reviewable inputs with published weights. |
| **Override (price)** | *(not shown)* | Time-boxed, audited deviation from the resolved price, with reason and authority level. |
| **Payment attempt** | *(not shown)* | A single provider interaction toward completing a payment (retry, timeout, failure). |
| **Payment state** | Status pembayaran | PENDING, AUTHORIZED, PAID, FAILED, EXPIRED, CANCELLED, REFUNDED. `PAID` requires verified evidence. |
| **PENDING_VERIFICATION** | Menunggu verifikasi | Honest state for a static-QRIS payment recorded by the operator but not yet verified by HQ Finance. |
| **Price policy** | Harga | Scoped price rule (ORG / AREA / LOCATION) with effective dates, reason, and approval trail. |
| **Price snapshot** | Harga saat transaksi | The resolved unit price stored immutably on a sale line; historical sales are never recomputed. |
| **QRIS** | QRIS | Indonesian national QR payment standard (Bank Indonesia/ASPI), accepted via a licensed provider. |
| **Recognition period** | Periode penghargaan | A defined window (day/month/year) with published weights for operator recognition. |
| **Reconciliation (manual)** | — | HQ Finance matching a payment/settlement with explicit evidence and reason; the only way a static-QRIS payment becomes `PAID`. |
| **Region** | Wilayah | Top-level geographic grouping (Jakarta, Bandung, …). |
| **Restock request** | Minta barang | Operator-initiated request for stock, acknowledged by the warehouse. |
| **Reward instance** | Hadiah | Single-use entitlement issued to a loyalty account; redemption is enforced by a unique constraint. |
| **Sale** | Penjualan | Completed transaction with items, price snapshots, location, operator, payment, and timestamp. |
| **Selling location / selling point** | Lokasi jualan | A place where a stall may sell: name, address, landmark, windows, notes, status. Statuses are operational, never a legal assertion. |
| **Settlement** | Pencairan | Provider → bank outcome for digital payments, matched against expected amounts. |
| **Shift** | Shift | Bounded working session of one operator on one stall; the unit of cash accountability. |
| **Static QRIS** | QRIS | A merchant-presented QR where the customer enters the amount; no per-transaction API call or callback. |
| **Stock movement** | Pergerakan stok | Append-only record of stock changing hands or state (issue, return, waste, damage, sample, staff meal, adjustment, unknown). |
| **Stock variance** | Selisih stok | Expected ending stock vs counted ending stock, always explainable by a reason (or explicitly `UNKNOWN`). |
| **Stall** | Gerobak / stan | The physical vending asset (cart, push cart, motorbike setup, kiosk, temporary stand). |
| **Supervisor** | Pengawas | Area-level role: assignments, approvals, incident follow-through, coaching. |
| **UNVERIFIED_FIELD_EXPENSE** | Biaya tak terduga di lapangan | Neutral category for a payment demanded in the field that the operator cannot or does not want to attribute. Recorded as reported; **not** a legal validation. |
| **UUIDv7** | *(not shown)* | Time-ordered unique identifier used for all primary keys; opaque to clients. |
| **Uang pas** | Uang pas | "Exact money" one-tap option in cash entry. |
| **Void (sale)** | Batalkan | Audited reversal preserving the original sale; never a deletion. |
| **Works offline** | Bisa tanpa internet | The operator can start a shift, sell for cash, record expenses, update stock, and submit a closing without connectivity; digital payments are excluded by design. |
