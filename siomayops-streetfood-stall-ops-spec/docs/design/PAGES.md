# Page Inventory

**Document ID:** DOC-DESIGN-PAGES
**Status:** Phase 0 specification. Page shells exist under `src/app/**` and render nothing but a
"Phase 0 shell" note; every task below is **NOT IMPLEMENTED**.
**Related:** `DESIGN.md` (§4 tap budgets, §5 states), `docs/design/DESIGN-SYSTEM.md`, `API.md`,
`docs/product/{SHIFTS,HQ-DASHBOARD}.md`, `docs/operations/API-READ.md`

---

## 1. Operator surfaces (installed PWA, 360×640, one thumb)

| Route (shell) | Purpose | Primary actions | Tap budget | Key elements | Tasks |
| --- | --- | --- | --- | --- | --- |
| `/` (Beranda penjual) | Where am I today and what do I do next | Mulai shift · Jual · Uang keluar · Butuh bantuan | 2 taps to any action | Active-shift strip (stall, location, elapsed), offline banner, pending-sync count, today's totals | T-SHIFT-001, T-OFF-001 |
| `/shift` | Start, suspend, resume, inspect the shift | Mulai · Jeda · Lanjut | 4 taps to start | Opening cash (prefilled from last closing), planned location, starting stock, business-day label | T-SHIFT-001/002 |
| `/sell` | Sell | Item tile → payment method → amount/change | 4 taps (1 item, cash) | Server-provided item grid (top items first), cart total, method choice, "uang pas", change display | T-MENU-002, T-SALE-001/002, T-PAY-002 |
| `/expenses` | Record money that left the box | Kategori chip → jumlah → simpan | 4 taps | Neutral categories incl. `UNVERIFIED_FIELD_EXPENSE`, optional note, optional photo, cash/personal toggle | T-EXP-001 |
| `/stock` | Movements and counts | Catat pergerakan · Hitung stok | 4 taps for a count row | Per-item count entry, `UNCOUNTED` option, reason chips with `UNKNOWN`, evidence for waste | T-STOCK-001/002 |
| `/closing` | Close the day | Hitung stok → hitung uang → kirim | 8 taps | Expected vs counted, neutral variance, mandatory reason beyond tolerance, unresolved-verification list, submit-as-pending when offline | T-CLOSE-001/003 |
| `/alerts` | Notifications and requests | Tandai dibaca · Balas | 2 taps | Alert list by severity, operational request threads anchored to records | T-ALERT-001, T-COMM-001 |
| `/location` (within `/shift`) | Report where I am selling | Tiba · Konfirmasi tetap · Pindah + alasan | 3 taps | Current location card, report history for this shift, one-shot "use my position" prefill only | T-LOC-004/005 |
| `/incidents` | Report an incident | Kategori → tingkat → kirim | 4 taps | Category chips, severity, description, optional photo, offline-capable | T-INC-001 |
| First-run / install | Install the PWA and sign in | Install · Nomor HP → kode | — | Plain-language privacy notice, offline explanation, no forced tutorial | T-SEC-001, T-FOUND-002 |

Operator page rules: no horizontal scrolling at 360 px; every flow resumable after interruption;
no modal that can trap an unsent record; the current shift's state always visible; digital payment
creation visibly disabled with an explanation when offline.

## 2. Supervisor surfaces (mobile-first PWA, same role-based navigation)

| Route (shell) | Purpose | Primary actions | Tasks |
| --- | --- | --- | --- |
| `/team` | Who is selling where right now, with freshness | Open a shift, call, message | T-HQ-001, T-COMM-001 |
| `/approvals` | Pending approvals (overrides, closings, handovers) | Approve · Return with reason | T-PRICE-004, T-CLOSE-002 |
| `/incidents` (supervisor view) | Incidents in my area by severity and age | Acknowledge · Assign · Resolve | T-INC-002 |
| `/coaching` | Variance and data-quality context for a conversation | Open shift records, note | T-CLOSE-002, T-PERF-002 |
| `/locations` | Selling points in my area, statuses and windows | Set status with reason and expiry | T-LOC-002 |

Supervisor rules: approvals show *what* is being approved and *why it was requested*; an approval
never silently changes a recorded fact; a return always carries a reason the operator can read.

## 3. HQ surfaces (desktop console)

| Route (shell) | Purpose | Primary actions | Tasks |
| --- | --- | --- | --- |
| `/hq` | Ten cards (§`docs/product/HQ-DASHBOARD.md`) with freshness | Drill down, filter by area, export | T-HQ-001/002/003 |
| `/hq/verification` | Payment verification queue | Query provider, record reconciliation with reason + evidence | T-PAY-004 |
| `/hq/expenses` | Expense review queue and pattern flags | Review · Reject with reason · Escalate | T-EXP-002/003 |
| `/hq/variance` | Cash and stock variance review | Review with reason · Request coaching note | T-CLOSE-002, T-STOCK-003 |
| `/hq/incidents` | Incident board with SLA status | Acknowledge · Assign · Close | T-INC-002 |
| `/hq/settlements` | Settlement expectations vs outcomes | Mark matched/short/over/missing/disputed with evidence | T-PAY-004, T-CLOSE-004 |
| `/hq/menu` `/hq/pricing` | Catalog and price policies | Publish policy (reason + effective date) · availability | T-MENU-001/002, T-PRICE-001 |
| `/hq/people` | Operators, assignments, capabilities, recognition review | Assign · Set capability with reason · Review awards | T-OP-002, T-STALL-002, T-REC-002 |
| `/hq/locations` | Selling points, coverage, dormant spots | Verify a proposal · Merge/split with audit | T-LOC-001/003 |
| `/hq/audit` | Audit search and shift reconstruction | Search by actor/subject/action, export | T-FOUND-003 |
| `/hq/config` | Thresholds, flags, categories, provider settings (no secrets in UI) | Change with reason (audited) | T-AUTHZ-001, T-HQ-002 |

HQ rules: every card shows `computedAt` and dims when stale (FR-HQ-008); verified and unverified
digital amounts are visually and arithmetically separate; every number can be drilled to records
within scope; exports are audited; a Finance session never lands on coverage and vice versa.

## 4. Auditor surface (read-only)

| Route (shell) | Purpose | Constraint | Task |
| --- | --- | --- | --- |
| `/hq/audit` (auditor session) | Search, reconstruct, export | No write action exists in this role's UI; export is audited | T-FOUND-003 |

## 5. Customer touchpoints (no account, no app install)

| Touchpoint | Content | Constraint | Task |
| --- | --- | --- | --- |
| Payment confirmation (on the operator's screen) | Verified state only; "Menunggu verifikasi" while unverified | Never show a success state that the server has not verified | T-PAY-002 |
| Optional receipt link / QR | Itemised lines with honest payment state | No phone number or registration required to buy | T-SALE-001 |
| Optional loyalty enrolment page | One-sentence purpose, consent checkbox, refusal path | Consent recorded with version and timestamp; refusal changes nothing | T-LOY-001 |

## 6. Global page requirements

1. Every page defines: loading, empty, offline, stale, error, permission-denied (DESIGN.md §5).
2. Every operator page works with no connectivity except where money honesty requires the opposite
   (digital payment creation, loyalty identification/redeem), and says so plainly.
3. Every money figure on a page has one source of truth and shows its verification status.
4. No page renders data the viewer's scope does not include — the API refuses, and the UI never
   compensates with client-side filtering alone.
5. No page introduces a data collection outside `PRIVACY.md`.
