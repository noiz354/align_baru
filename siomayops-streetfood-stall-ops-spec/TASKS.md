# TASKS — Implementation Backlog (Phase 0: specification only)

**Document ID:** DOC-TASKS
**Status:** Phase 0 — **no task may be implemented yet**
**Related:** `ROADMAP.md`, `docs/TRACEABILITY.md`, `AGENTS.md`

Every task below defines the same field set. `Implementation: NOT PART OF CURRENT PHASE` is
implicit for all of them; the skeleton throws `Not implemented: T-XXX-XXX`.

**Field legend:** Requirements · Goal · ADR · Product Docs · Modules · Dependencies · Expected
Behavior · Invariants · Finance · Security · Privacy · Offline · Concurrency · Failures · Tests ·
Manual QA · Definition of Done (DoD).

---

## T-FOUND-001 — Repository, tooling, and CI skeleton

- **Requirements:** NFR-OPS-002..003
- **Goal:** A repository that runs lint, typecheck, unit/browser/e2e tests and a bundle-budget check, with no business logic.
- **ADR:** ADR-0023, ADR-0036, ADR-0024
- **Product Docs:** `TESTING.md`, `CONTRIBUTING.md`
- **Modules:** root config, `.github/workflows`, `tests/*`
- **Dependencies:** none
- **Behavior:** CI runs on every PR; failing gates block merge; every stub throws with its task ID.
- **Invariants:** no NotImplemented stub returns fabricated data; no dependency outside `STACK-2026.md` without an ADR.
- **Finance:** none. **Security:** dependency + secret scanning on. **Privacy:** no production data in CI.
- **Offline:** n/a. **Concurrency:** n/a. **Failures:** a red gate is never bypassed by admin merge.
- **Tests:** unit runner boots; typecheck passes on skeletons; bundle budget placeholder asserted.
- **Manual QA:** verify a fresh clone can run the suite in ≤ 10 min.
- **DoD:** repo builds, tests run (TODO-only or trivially green), CI green.

## T-FOUND-002 — Design tokens and component shells

- **Requirements:** NFR-ACCESS-001..008, NFR-UX-001..004
- **Goal:** Operator-scale tokens (sizes, contrast, spacing, monetary typography) and shell components (BigButton, MoneyText, NumericKeypad, StatusBanner, OfflineBar).
- **ADR:** none new (design system is product-level)
- **Product Docs:** `DESIGN.md` §3.7/§8, `docs/design/DESIGN-SYSTEM.md`
- **Modules:** `src/shared/ui`, `docs/design`
- **Dependencies:** T-FOUND-001
- **Behavior:** components render in shells only; no data wiring; sizes enforce A-1/A-2 tokens.
- **Invariants:** minimum tap sizes are encoded in tokens, not in ad-hoc styles.
- **Finance:** none. **Security:** none. **Privacy:** none.
- **Offline:** components must render correctly offline (no external fonts/CDNs).
- **Concurrency:** n/a. **Failures:** n/a.
- **Tests:** browser tests assert computed sizes and contrast tokens.
- **Manual QA:** glove/sunlight checklist authored (executed later).
- **DoD:** tokens + shells exist, documented, tested for size/contrast.

## T-FOUND-003 — Audit event infrastructure

- **Requirements:** FR-AUDIT-001..008, NFR-SEC-010
- **Goal:** Append-only `AuditEvent` writer + query port; every money mutation must call it.
- **ADR:** ADR-0026
- **Product Docs:** `SECURITY.md` §7, `DATA_MODEL.md`
- **Modules:** `src/features/audit`, `src/server/db`
- **Dependencies:** T-FOUND-001, T-FOUND-006
- **Behavior:** audit rows capture actor, action, entity, before/after, reason (where required), request id.
- **Invariants:** no update/delete path exists for audit rows (INV-10).
- **Finance:** underpins every money record. **Security:** tamper-evidence plan (hash chain) specified.
- **Privacy:** audit stores IDs, not PII payloads.
- **Offline:** audit is emitted at server acceptance; device-time-sensitive actions note device timestamps.
- **Concurrency:** audit write happens in the same transaction as the change.
- **Failures:** audit write failure aborts the transaction (fail closed).
- **Tests:** integration: audit exists for each money mutation; update attempt fails.
- **Manual QA:** auditor can search by actor/entity/time.
- **DoD:** audit infrastructure proven by tests; no money path lacking audit.

## T-FOUND-004 — Idempotency infrastructure

- **Requirements:** FR-SALE-003, NFR-SEC-004
- **Goal:** Reusable idempotency: key storage, request fingerprinting, replay response cache.
- **ADR:** ADR-0013
- **Product Docs:** `API.md` §0, `OFFLINE.md` §4
- **Modules:** `src/server/db`, `src/shared/contracts`
- **Dependencies:** T-FOUND-001
- **Behavior:** first request executes and stores the response; replays return the stored response marked as replay; mismatched payload ⇒ `IDEMPOTENCY_MISMATCH`.
- **Invariants:** idempotency keys unique per `(organization, route, key)` (INV-15).
- **Finance:** prevents duplicate money records.
- **Security:** prevents replay abuse; keys are opaque.
- **Privacy:** request fingerprints must not log PII (hash only).
- **Offline:** the same mechanism serves offline replays.
- **Concurrency:** two simultaneous identical requests ⇒ one executes, one waits/returns replay.
- **Failures:** storage failure ⇒ fail closed (do not execute twice).
- **Tests:** integration: concurrent duplicate requests; payload mismatch; expiry behaviour.
- **Manual QA:** retry a sale from the device twice; single record results.
- **DoD:** every mutating route can adopt the middleware with one line; tests prove behaviour.

## T-FOUND-005 — Auth port and session shell

- **Requirements:** FR-OPERATOR-008, NFR-SEC-001
- **Goal:** `AuthPort`/`SessionContext` interfaces and a fake in-memory provider for development; no real authentication.
- **ADR:** ADR-0015 (deferred), ADR-0016
- **Product Docs:** `SECURITY.md` §3, `docs/security/PERMISSIONS.md`
- **Modules:** `src/server/auth`, `src/features/*`
- **Dependencies:** T-FOUND-001
- **Behavior:** feature code depends on the port; the fake returns a configurable actor for tests only.
- **Invariants:** no feature accesses a session outside the port (lint rule).
- **Finance:** n/a. **Security:** the fake must be impossible to enable in production (env-guarded + test).
- **Privacy:** session data minimised (id, role, scope).
- **Offline:** session cached on device for the offline period; revocation honoured on reconnect.
- **Concurrency:** n/a. **Failures:** missing session ⇒ `UNAUTHENTICATED`, never a default actor.
- **Tests:** unit: fake refuses to boot with `NODE_ENV=production`.
- **Manual QA:** reviewer confirms no production path uses the fake.
- **DoD:** ports fixed and documented; real implementation scheduled in VS-17.

## T-FOUND-006 — Money and time primitives

- **Requirements:** FR-CASH-003, FR-PRICE-007, NFR-COMP-002
- **Goal:** `Money` value object (integer minor units + currency) and business-day utilities (`Asia/Jakarta`, cut rule), with no business logic beyond arithmetic invariants.
- **ADR:** ADR-0006, ADR-0033
- **Product Docs:** `PRICING.md` §7, `DATA_MODEL.md` §5
- **Modules:** `src/shared/money`, `src/shared/time`
- **Dependencies:** T-FOUND-001
- **Behavior:** add/subtract/compare/allocate; parsing from provider decimal strings; formatting `Rp 12.500`; `businessDay(instant)`.
- **Invariants:** no float in the money path (INV-05); currency mismatch throws; allocation preserves totals exactly.
- **Finance:** foundation of all money correctness. **Security:** n/a. **Privacy:** n/a.
- **Offline:** unit tests run in the browser bundle unchanged.
- **Concurrency:** n/a. **Failures:** invalid input throws typed errors, never coerces.
- **Tests:** unit: rounding, allocation, currency mismatch, business-day boundary at 00:30 and 01:30.
- **Manual QA:** spot-check formatted values in Indonesian locale.
- **DoD:** primitives used by every later money task; lint ban on `number` money fields active.

---

## T-OP-001 — Operator registry and profile

- **Requirements:** FR-OPERATOR-001..003, FR-OPERATOR-006, FR-OPERATOR-009
- **Goal:** HQ can create/edit operator profiles (name, phone, area, contract type, training state, start date) with minimal PII.
- **ADR:** ADR-0016, ADR-0031
- **Product Docs:** `OPERATORS.md` §2/§3, `PRIVACY.md` §1
- **Modules:** `src/features/operators`, `src/domain/*`
- **Dependencies:** T-FOUND-003..006, T-AUTHZ-001
- **Behavior:** create/read/update with scope checks; phone verified; list masked by default.
- **Invariants:** phone is unique per organization; PII fields access-masked by role (NFR-PRIVACY-005).
- **Finance:** none directly. **Security:** scope checks; audit on changes.
- **Privacy:** data minimisation; no ID documents; consent notice recorded.
- **Offline:** operator list cached for assignment display only (no PII beyond name/mask).
- **Concurrency:** duplicate phone prevented by unique constraint.
- **Failures:** partial creation rolls back; no half-created operators.
- **Tests:** integration: uniqueness, scope denial, masking by role.
- **Manual QA:** HQ creates an operator, supervisor sees masked phone.
- **DoD:** profiles usable by VS-1 shift assignment.

## T-OP-002 — Operator operational status lifecycle

- **Requirements:** FR-OPERATOR-004, FR-OPERATOR-007, `STATE_MACHINE.md` §2
- **Goal:** Implement the status machine with suspension/unsuspension rules.
- **ADR:** ADR-0016
- **Product Docs:** `OPERATORS.md` §4
- **Modules:** `src/features/operators`, `src/domain/operators`
- **Dependencies:** T-OP-001
- **Behavior:** transitions only per the state machine; suspension requires reason + actor and is audited; suspended operators cannot start shifts.
- **Invariants:** forbidden transitions throw `InvalidTransition`; status is never inferred from shift records.
- **Finance:** prevents fraudulent sales while suspended.
- **Security:** suspension permission is HQ Ops only.
- **Privacy:** suspension reasons are restricted to HR/Ops roles, not peers.
- **Offline:** a suspended status change takes effect at sync; device shows blocked state after sync.
- **Concurrency:** suspension racing with shift start ⇒ server wins; start rejected with reason.
- **Failures:** if status is unknown, deny selling (fail closed).
- **Tests:** unit: full transition matrix incl. forbidden moves; integration: suspension blocks shift start.
- **Manual QA:** suspend an operator mid-day; verify blocking and audit.
- **DoD:** status machine enforced centrally and tested.

## T-STALL-001 — Stall registry

- **Requirements:** FR-STALL-001..004, FR-STALL-007..008
- **Goal:** HQ can manage stalls (code, type, home area, equipment list, capacity notes).
- **ADR:** ADR-0025 (configurable types), ADR-0031
- **Product Docs:** `STALLS.md`
- **Modules:** `src/features/stalls`
- **Dependencies:** T-FOUND-003/004, T-OP-001
- **Behavior:** CRUD with scope; stall codes unique; types come from configuration.
- **Invariants:** ST-INV-02/03 (home area change audited; no dual PRIMARY operators).
- **Finance:** none. **Security:** scope checks. **Privacy:** stall data is non-personal.
- **Offline:** stall list cached for shift start.
- **Concurrency:** duplicate code blocked by unique index.
- **Failures:** retiring a stall with an active shift fails with a clear message.
- **Tests:** integration: unique code, retire guard, equipment update audit.
- **Manual QA:** create cart vs kiosk; verify equipment list visible to operator.
- **DoD:** stall records usable by shift and stock tasks.

## T-STALL-002 — Assignments and history

- **Requirements:** FR-OPERATOR-006, FR-STALL-005
- **Goal:** Assignment records with validity windows and preserved history.
- **ADR:** ADR-0031
- **Product Docs:** `OPERATORS.md` §3, `STALLS.md` §6
- **Modules:** `src/features/stalls`, `src/features/operators`
- **Dependencies:** T-OP-001, T-STALL-001
- **Behavior:** assign/unassign with dates; historical attribution queryable ("who was accountable on date X").
- **Invariants:** no overlapping PRIMARY assignments; history immutable.
- **Finance:** attribution for cash accountability. **Security:** assignment changes audited.
- **Privacy:** assignment history is work data, scoped.
- **Offline:** cached; conflicts at sync surface with reason.
- **Concurrency:** simultaneous assignments ⇒ one wins; second is rejected with a diff.
- **Failures:** failed assignment leaves no partial rows.
- **Tests:** integration: overlap prevention, historical query, audit.
- **Manual QA:** change an operator's stall; verify history preserved.
- **DoD:** accountability queries answerable from data.

## T-AUTHZ-001 — Permission matrix enforcement

- **Requirements:** FR-AUDIT-005, FR-OPERATOR-003, FR-OPERATOR-008, NFR-SEC-002
- **Goal:** `authorize(actor, action, subject, scope)` implemented once, tested per role/route.
- **ADR:** ADR-0016
- **Product Docs:** `docs/security/PERMISSIONS.md`
- **Modules:** `src/server/auth`, all features
- **Dependencies:** T-FOUND-005
- **Behavior:** every use case declares its permission; denial is audited; scopes resolve via organization/area/stall/self.
- **Invariants:** repository methods require an explicit scope (INV-14).
- **Finance:** prevents unauthorised money operations.
- **Security:** single choke point; no route bypasses it (lint + test).
- **Privacy:** field-level masking complements scope.
- **Offline:** device cannot exceed permissions it had at last sync; server re-checks on sync.
- **Concurrency:** role changes take effect on the next request (no cached permissions in the device).
- **Failures:** fail closed on unknown role/scope.
- **Tests:** integration sweep: every route × every role (allow/deny matrix).
- **Manual QA:** verify denial messages are clear and non-revealing.
- **DoD:** matrix test green; documented in `docs/security/PERMISSIONS.md`.

---

## T-LOC-001 — Selling point registry

- **Requirements:** FR-LOCATION-001..003, FR-LOCATION-010, FR-LOCATION-013
- **Goal:** Manage region → area → selling point hierarchy with landmark, coordinates (optional), windows, notes, status.
- **ADR:** ADR-0007, ADR-0025, ADR-0031
- **Product Docs:** `LOCATIONS.md` §1–§3
- **Modules:** `src/features/locations`
- **Dependencies:** T-FOUND-003/004, T-AUTHZ-001
- **Behavior:** CRUD; free-text "new location" submitted by an operator becomes a draft for HQ to promote.
- **Invariants:** `permissionStatus` defaults to `NOT_ASSESSED`; never inferred (FR-LOCATION-010).
- **Finance:** none. **Security:** scope; no public endpoint exposing all locations.
- **Privacy:** a selling point is a place; operator linkage happens via reports (PRIVACY.md).
- **Offline:** location list cached with timestamp; free-text fallback allowed.
- **Concurrency:** duplicate names allowed but flagged; coordinates optional.
- **Failures:** invalid coordinates rejected; partial writes rolled back.
- **Tests:** integration: hierarchy, draft promotion, status defaults.
- **Manual QA:** create a location from the field note; HQ promotes it.
- **DoD:** locations available for shift reporting.

## T-LOC-002 — Location status model

- **Requirements:** FR-LOCATION-003, FR-LOCATION-008, FR-LOCATION-011
- **Goal:** Statuses AVAILABLE/ACTIVE/CROWDED/TEMPORARILY_UNAVAILABLE/RESTRICTED/INACTIVE with operator reporting.
- **ADR:** ADR-0007
- **Product Docs:** `LOCATIONS.md` §3/§5, `STATE_MACHINE.md` §4
- **Modules:** `src/features/locations`
- **Dependencies:** T-LOC-001
- **Behavior:** operator one-tap status reports flow to the operations timeline; HQ can set RESTRICTED with reason.
- **Invariants:** statuses are operational, never assertions of legality; RESTRICTED requires reason + audit.
- **Finance:** none. **Security:** restrictive changes are HQ-only.
- **Privacy:** no operator identity attached to public-facing status.
- **Offline:** reports queue; conflicts surface on sync.
- **Concurrency:** multiple operators reporting the same location ⇒ most recent with crowd count.
- **Failures:** unknown status values rejected by schema.
- **Tests:** integration: transitions, crowding count, restricted override denial for operators.
- **Manual QA:** report crowded from two operators; HQ sees crowding.
- **DoD:** statuses drive HQ advisory cards.

## T-LOC-003 — Area supervision and coverage model

- **Requirements:** FR-HQ-002, FR-LOCATION-009
- **Goal:** Areas with supervisors; coverage expectations (planned selling points per area/day).
- **ADR:** ADR-0031
- **Product Docs:** `HQ.md` §4.1, `LOCATIONS.md` §1
- **Modules:** `src/features/locations`, `src/features/operators`
- **Dependencies:** T-LOC-001, T-OP-001
- **Behavior:** assign supervisors; define expected coverage; gaps surfaced as advisory (not punitive).
- **Invariants:** a supervisor can only manage areas in scope.
- **Finance:** none. **Security:** scope checks. **Privacy:** none beyond work data.
- **Offline:** coverage expectations cached for supervisors.
- **Concurrency:** overlapping supervisor assignment allowed but flagged.
- **Failures:** missing supervisor ⇒ HQ Ops fallback owner.
- **Tests:** integration: scope, gap computation with seeded data.
- **Manual QA:** supervisor sees only their area's coverage.
- **DoD:** coverage used by VS-10 dashboard.

---

## T-SHIFT-001 — Start shift

- **Requirements:** FR-OPERATOR-005, FR-SHIFT-001..005, FR-SHIFT-016
- **Goal:** Eventually allow an operator to open a shift with stall, location, opening cash and price acknowledgement — offline-capable and idempotent.
- **ADR:** ADR-0013, ADR-0017, ADR-0033
- **Product Docs:** `API.md` §1, `OPERATORS.md` §4, `STATE_MACHINE.md` §1
- **Modules:** `src/features/shifts`, `src/domain/shift`
- **Dependencies:** T-OP-002, T-STALL-002, T-LOC-001, T-OFF-001
- **Behavior:** create shift (PLANNED→OPEN), emit `ShiftStarted`, create first location report, set operator status, start stock snapshot hook.
- **Invariants:** one active shift per operator and per stall (INV-03/04); business day server-derived (ADR-0033); location must not be RESTRICTED/INACTIVE.
- **Finance:** opening cash recorded (float) so closing can reconcile.
- **Security:** self-scope; suspended operators blocked.
- **Privacy:** shift times are work data; no location outside the shift.
- **Offline:** full offline start; server may reject on conflict with a precise reason.
- **Concurrency:** double start from two devices ⇒ unique index picks one; the other receives the canonical shift.
- **Failures:** stale price cache blocks selling later, not shift start; partial failure rolls back entirely.
- **Tests:** integration: double start, suspended operator, restricted location, offline replay; unit: state transitions.
- **Manual QA:** QA-S-01..03, QA-S-05.
- **DoD:** shift start works online and offline, HQ sees ACTIVE.

## T-SHIFT-002 — Starting stock snapshot

- **Requirements:** FR-SHIFT-003, FR-STOCK-004
- **Goal:** Capture counted starting quantities per stock item at shift start (fast path: confirm issued quantities in one tap).
- **ADR:** ADR-0030
- **Product Docs:** `INVENTORY.md` §5
- **Modules:** `src/features/shifts`, `src/features/inventory`
- **Dependencies:** T-SHIFT-001, T-STOCK-001
- **Behavior:** snapshot rows with `phase=START`; expects quantities recomputed server-side later.
- **Invariants:** positions derived from movements (INV-13); counted ≠ expected is allowed and recorded.
- **Finance:** basis for variance at closing. **Security:** self-scope.
- **Privacy:** stock data is business data.
- **Offline:** counts queue; UI shows "recorded on device".
- **Concurrency:** duplicate snapshot for the same shift/item ⇒ idempotent.
- **Failures:** unknown stock item ⇒ recorded as "Lainnya" note rather than dropped.
- **Tests:** integration: duplicate report, unknown item note, derived position integrity.
- **Manual QA:** QA-K-01.
- **DoD:** starting snapshot available to closing maths.

## T-LOC-004 — Report selling location

- **Requirements:** FR-LOCATION-004..006, FR-LOCATION-014, NFR-PRIVACY-003, NFR-PRIVACY-011
- **Goal:** Allow an active operator to report the current selling location for their active shift, with optional one-shot GPS assistance.
- **ADR:** ADR-0007, ADR-0039
- **Product Docs:** `LOCATIONS.md` §4/§6, `API.md` §1a/§1b/§2
- **Modules:** `src/features/locations`, `src/domain/location`
- **Dependencies:** T-SHIFT-001
- **Behavior:** create/update the current `LocationReport` with server arrivedAt; close the previous interval on a move; derive organization/operator/shift/stall from the authorized session and server records; optionally attach the explicitly tapped GPS sample; HQ board continues to use selling-point reports only.
- **Invariants:** operator must have an active shift; stall must belong to the assigned operation; location must not be INACTIVE; report is timestamped; previous history is preserved.
- **Finance:** none. **Security:** self-scope.
- **Privacy:** **do not activate continuous/background tracking**; no `watchPosition`; reports exist only during shifts. Under ADR-0039, an optional one-shot fix may be attached to each explicitly submitted location report, retained no more than 14 days, and can form only a sparse shift-bound sequence; it is advisory and never used for attendance, discipline, or performance scoring.
- **Offline:** manual reports may use the existing sync path; Page 10 does not durably queue GPS samples, and sync must not persist a sample. One open report per shift is enforced server-side.
- **Concurrency:** two reports for the same location ⇒ idempotent (returns the existing open report).
- **Failures:** back-dating beyond a configured window is rejected; unknown location id rejected.
- **Tests:** valid location; unauthorized/cross-operator shift; cross-area location; inactive shift; duplicate/idempotent report; invalid/stale GPS sample; self-scoped read; expired-sample purge; GPS denied manual fallback; offline resubmission does not retain GPS.
- **Manual QA:** QA-S-01, QA-S-02 plus `/operator/location` one-shot, denied-permission, reload/persistence and mobile-viewport checks.
- **DoD:** HQ can see "where is this stall selling now" from reports alone.

## T-LOC-005 — Change location with reason

- **Requirements:** FR-HQ-003, FR-LOCATION-007
- **Goal:** Mid-shift move with a controlled reason, preserving intervals and surfacing to HQ.
- **ADR:** ADR-0007
- **Product Docs:** `LOCATIONS.md` §4/§5, `API.md` §3
- **Modules:** `src/features/locations`
- **Dependencies:** T-LOC-004
- **Behavior:** close previous report (departedAt), open the new one, emit `LocationChanged`, add timeline entry, notify supervisor when consequential.
- **Invariants:** reason required; intervals never overlap; history append-only.
- **Finance:** none directly (affects location performance baselines).
- **Security:** self-scope. **Privacy:** neutral recording of "asked to move"; no speculation fields.
- **Offline:** queued; ordering preserved per shift.
- **Concurrency:** move while closing ⇒ rejected with instructions (closing captures the location).
- **Failures:** invalid reason rejected by schema; a move to a RESTRICTED location warns and requires supervisor note.
- **Tests:** reason validation; interval closure; concurrent move+close; offline ordering.
- **Manual QA:** QA-T-06 scenario for movement, QA-O-08.
- **DoD:** moves visible in HQ timeline and location history.

## T-OFF-001 — Outbox queue and sync batch

- **Requirements:** FR-SALE-002, NFR-OFFLINE-001..005
- **Goal:** Device-side queue (IndexedDB) + `POST /api/v1/sync/batches` with per-record results and backoff.
- **ADR:** ADR-0017, ADR-0013
- **Product Docs:** `OFFLINE.md` §3–§6, `API.md` §0
- **Modules:** `src/features/offline` (client), `src/app/api/v1/sync`
- **Dependencies:** T-FOUND-004
- **Behavior:** ordered per aggregate; batch results ACCEPTED/DUPLICATE/REJECTED/DEFERRED; UI badges; retry with exponential backoff.
- **Invariants:** at-least-once with idempotent application (NFR-REL-005); no silent record drop.
- **Finance:** the reliability backbone of offline money.
- **Security:** replay is re-validated server-side (permissions, prices, shift state).
- **Privacy:** queue stores only what the operator recorded; no telemetry beyond necessity.
- **Offline:** obviously; also must handle partial connectivity (timeouts mid-batch).
- **Concurrency:** two tabs of the same device must not double-send (single-flight lock).
- **Failures:** corrupted entries quarantined + exportable; server rejection surfaces a fixable message.
- **Tests:** integration: batch ordering, dependency-gap deferral, duplicate replay; browser: lock behaviour.
- **Manual QA:** QA-O-01..QA-O-05.
- **DoD:** an entire offline day syncs with zero loss and zero duplicates.

## T-HQ-001 — Active stall visibility (HQ v1)

- **Requirements:** FR-HQ-001..003, FR-LOCATION-009
- **Goal:** A minimal HQ view: active stalls, current reported locations, moves today, unclosed shifts, with freshness.
- **ADR:** ADR-0022 (telemetry hooks later)
- **Product Docs:** `HQ.md` §4, `docs/product/HQ-DASHBOARD.md`
- **Modules:** `src/features/hq`, read-model v1
- **Dependencies:** T-SHIFT-001, T-LOC-004/005, T-OFF-001
- **Behavior:** read-only cards with `computedAt` + unsynced count; drill-down to shift detail.
- **Invariants:** no per-operator continuous tracking; cards show staleness explicitly.
- **Finance:** none. **Security:** scope-checked reads. **Privacy:** HQ sees selling points and stalls; operator names only where operationally necessary.
- **Offline:** n/a (HQ is online); stale data labelled.
- **Concurrency:** read model updates idempotently; last-writer-wins on aggregates recomputed from facts.
- **Failures:** read model unavailable ⇒ explicit "data not ready", never a wrong number.
- **Tests:** integration: freshness fields; e2e: HQ sees a stall within 60 s of shift start.
- **Manual QA:** QA-H-01, QA-H-08.
- **DoD:** the VS-3 outcome is demonstrable: **operator start → HQ sees active stall**.

---

## T-MENU-001 — Menu catalog (configuration-driven)

- **Requirements:** FR-MENU-001..002
- **Goal:** Items, categories, portions, packages, sort order, synonyms — all configuration.
- **ADR:** ADR-0025
- **Product Docs:** `MENU.md` §2/§3
- **Modules:** `src/features/menu`
- **Dependencies:** T-FOUND-003/004, T-AUTHZ-001
- **Behavior:** CRUD + CSV import with row-level results; retirement blocked when active policies reference the item without replacement.
- **Invariants:** no hard-coded menu anywhere in code (test: grep-based guard).
- **Finance:** none directly (prices are separate).
- **Security:** HQ Ops managed; Finance notified on price-bearing changes.
- **Privacy:** none. **Offline:** catalog cached with `lastSyncedAt`; unknown item ⇒ explicit empty state.
- **Concurrency:** two edits ⇒ optimistic concurrency with diff.
- **Failures:** import is all-or-nothing per row with a readable error report.
- **Tests:** integration: import, retirement guard, package composition.
- **Manual QA:** build a 12-item catalog quickly; operator sees it after sync.
- **DoD:** the POS grid can be driven entirely from configuration.

## T-MENU-002 — Location availability

- **Requirements:** FR-MENU-003..005
- **Goal:** Per-location (and optional time-window) availability.
- **ADR:** ADR-0025
- **Product Docs:** `MENU.md` §2
- **Modules:** `src/features/menu`
- **Dependencies:** T-MENU-001, T-LOC-001
- **Behavior:** unavailable items hidden in POS with "lihat semua"; time windows advisory in POS, strict in reporting.
- **Invariants:** availability never overrides price resolution (an item with no price is not sellable).
- **Finance:** affects mix reporting. **Security:** scope (supervisor can manage own area).
- **Privacy:** none. **Offline:** cached; changes apply at sync.
- **Concurrency:** conflicting edits resolved by version check.
- **Failures:** invalid scope rejected.
- **Tests:** integration: hidden vs shown, window advisory, sellable-not-priced case.
- **Manual QA:** hide an item at one location; verify operator view.
- **DoD:** availability works without code changes.

## T-PRICE-001 — Price policies (CRUD + approval)

- **Requirements:** FR-PRICE-002..003
- **Goal:** Create/edit scoped price policies with reason, effective dates, approval where required.
- **ADR:** ADR-0008 (with ADR-0006)
- **Product Docs:** `PRICING.md` §3
- **Modules:** `src/features/pricing`
- **Dependencies:** T-MENU-001, T-FOUND-003
- **Behavior:** draft → publish with old/new diff; future-dated default; soft-deactivate instead of delete.
- **Invariants:** every change records old price, new price, effective date, scope, reason, creator, approver.
- **Finance:** margin integrity. **Security:** Finance review for large changes; audit mandatory.
- **Privacy:** none. **Offline:** policies cached; changes invalidate cache at sync.
- **Concurrency:** concurrent edits ⇒ `409` with diff and re-confirm.
- **Failures:** publish without required approval rejected.
- **Tests:** integration: diff capture, approval gate, soft delete, audit.
- **Manual QA:** publish a change; operator sees it after sync.
- **DoD:** price changes fully auditable.

## T-PRICE-002 — Deterministic price resolution

- **Requirements:** FR-PRICE-001, FR-PRICE-004, FR-PRICE-006
- **Goal:** Resolve effective price for `(item, location, instant)` with documented precedence and provenance.
- **ADR:** ADR-0008
- **Product Docs:** `PRICING.md` §2, `API.md` §5
- **Modules:** `src/domain/pricing`
- **Dependencies:** T-PRICE-001
- **Behavior:** LOCATION > AREA > ORG; newest effectiveFrom wins; ties fail loudly; no policy ⇒ not sellable; provenance returned.
- **Invariants:** historical snapshots never recomputed (INV-01/08).
- **Finance:** correct pricing at sale time. **Security:** resolution runs server-side only.
- **Privacy:** none. **Offline:** device uses a cached resolution and must warn when stale.
- **Concurrency:** resolution is read-only; concurrent publishes affect only later instants.
- **Failures:** ambiguity blocks the sale with a clear error and HQ alert.
- **Tests:** unit: precedence matrix, tie failure, temporal boundaries, package pricing.
- **Manual QA:** verify a changed price never alters an existing sale.
- **DoD:** resolution proven by unit tests with a truth table.

## T-PRICE-003 — Price acknowledgement (digest-bound)

- **Requirements:** FR-PRICE-005
- **Goal:** Operators acknowledge the exact price set they saw.
- **ADR:** ADR-0008
- **Product Docs:** `PRICING.md` §3, `API.md` §4
- **Modules:** `src/features/pricing`, `src/features/offline`
- **Dependencies:** T-PRICE-002
- **Behavior:** server computes a digest of the effective set; acknowledgement references the digest; stale digest ⇒ `STALE_DATA` and re-acknowledgement.
- **Invariants:** an acknowledgement never covers prices the operator did not see.
- **Finance:** price compliance. **Security:** cannot be forged by replaying an old digest.
- **Privacy:** none. **Offline:** queued acknowledgement validated at sync.
- **Concurrency:** two price publishes ⇒ operator acknowledges the latest digest only.
- **Failures:** mismatch surfaces a plain message, not a silent pass.
- **Tests:** integration: digest mismatch, replay of old digest, unacknowledged alerts.
- **Manual QA:** QA-T-06.
- **DoD:** HQ can list unacknowledged operators accurately.

## T-PRICE-004 — Override policy engine

- **Requirements:** FR-PRICE-007
- **Goal:** Overrides restricted by mode (HQ_ONLY / SUPERVISOR_APPROVED / OPERATOR_ALLOWED) with bounds and expiry.
- **ADR:** ADR-0009
- **Product Docs:** `PRICING.md` §4
- **Modules:** `src/features/pricing`
- **Dependencies:** T-PRICE-002
- **Behavior:** request → approve → apply; expiry automatic; every override audited with reason; daily HQ digest.
- **Invariants:** bounded validity; no open-ended overrides; never below a configured floor without approval.
- **Finance:** guards margin. **Security:** approval requires supervisor/HQ scope; operator self-approval blocked.
- **Privacy:** none. **Offline:** requests queue; **approval requires connectivity** (no offline approval).
- **Concurrency:** approval racing with expiry ⇒ expiry wins.
- **Failures:** expired override at sale time ⇒ base price applies and the operator is told.
- **Tests:** integration: each mode's allow/deny, bounds, expiry, audit, self-approval denial.
- **Manual QA:** QA-T-06 variant with an override.
- **DoD:** override behaviour is explicit, bounded, auditable.

---

## T-SALE-001 — Create sale with immutable snapshot

- **Requirements:** FR-CASH-001, FR-CUST-003..004, FR-SALE-001..003, FR-SALE-006, FR-SALE-011..012
- **Goal:** Create a sale whose line prices are resolved and snapshotted server-side at acceptance.
- **ADR:** ADR-0010, ADR-0006, ADR-0013
- **Product Docs:** `SALES.md` §3, `API.md` §5
- **Modules:** `src/features/sales`, `src/domain/sale`
- **Dependencies:** T-PRICE-002, T-SHIFT-001, T-OFF-001
- **Behavior:** validate → authorize → resolve prices → snapshot → totals → emit `SaleCompleted` → audit.
- **Invariants:** every line has a snapshot; totals derive from snapshots; client price mismatch ⇒ `409 STALE_DATA`.
- **Finance:** the core money record. **Security:** self-scope; no client-authored prices.
- **Privacy:** optional customer linkage is opaque (loyalty).
- **Offline:** via outbox; device price used only for display/confirmation.
- **Concurrency:** duplicate `clientSaleId` ⇒ one sale; two devices ⇒ converge on canonical.
- **Failures:** any validation failure ⇒ no partial sale; storage failure ⇒ safe to retry.
- **Tests:** unit: totals/rounding; integration: duplicate, stale price, out-of-shift, audit; e2e: QA-T-01.
- **Manual QA:** QA-T-01..03.
- **DoD:** a completed sale preserves history forever.

## T-SALE-002 — Cash payment and change

- **Requirements:** FR-CASH-002, FR-CASH-004, FR-PAYMENT-007, FR-SALE-007
- **Goal:** Cash entry with denominations, change computed server-side, running shift total.
- **ADR:** ADR-0006
- **Product Docs:** `PAYMENTS.md` §4, `DESIGN.md` §3.3
- **Modules:** `src/features/payments`, `src/features/sales`
- **Dependencies:** T-SALE-001
- **Behavior:** `POST /payments/cash`; change = received − amount; underpayment rejected.
- **Invariants:** integer arithmetic only; change never negative.
- **Finance:** cash integrity; basis for closing. **Security:** self-scope.
- **Privacy:** none. **Offline:** canonical offline path.
- **Concurrency:** payment already resolved ⇒ `409`, no double payment.
- **Failures:** transient errors retried via idempotency.
- **Tests:** integration: exact/over/under payment, duplicate payment, change correctness.
- **Manual QA:** QA-T-01/02 with real cash.
- **DoD:** cash sales are correct and fast.

## T-SALE-003 — Offline sale replay

- **Requirements:** FR-SALE-002, NFR-OFFLINE-001..005
- **Goal:** Sales recorded offline sync without duplicates and without losing the device-time fact.
- **ADR:** ADR-0017, ADR-0013
- **Product Docs:** `OFFLINE.md` §5–§7
- **Modules:** `src/features/sales`, `src/features/offline`
- **Dependencies:** T-SALE-001, T-OFF-001
- **Behavior:** queued sale → sync batch → accepted/duplicate/rejected with results shown per record.
- **Invariants:** device time preserved as `occurredAt`; business day derived server-side.
- **Finance:** no lost sales; no double counting. **Security:** replays re-validated.
- **Privacy:** none beyond existing.
- **Offline:** the point of the task.
- **Concurrency:** identical payload from two devices ⇒ single canonical sale.
- **Failures:** rejected sale shows precisely which field/condition failed and what to do.
- **Tests:** integration: replay, duplicate, stale price path; e2e: QA-O-01/02.
- **Manual QA:** QA-O-02.
- **DoD:** verified by replaying 20 offline sales with matching totals.

## T-SALE-004 — Void and correction

- **Requirements:** FR-AUDIT-002, FR-SALE-004..005, FR-SHIFT-014
- **Goal:** Audited reversal/correction preserving the original record.
- **ADR:** ADR-0026
- **Product Docs:** `SALES.md` §6, `STATE_MACHINE.md` §5
- **Modules:** `src/features/sales`
- **Dependencies:** T-SALE-001
- **Behavior:** void with reason (controlled list); same-day default; later voids need Finance; corrections create a linked new sale.
- **Invariants:** no in-place edit; original immutable; both visible; net totals correct.
- **Finance:** closing impact recomputed forward, never retroactively. **Security:** elevated permission.
- **Privacy:** reason text bounded; no inflammatory phrasing required.
- **Offline:** requests only online (no offline void).
- **Concurrency:** void vs closing in progress ⇒ closing includes the void result or is deferred.
- **Failures:** re-void rejected (`INVALID_TRANSITION`).
- **Tests:** integration: permission, reason, audit, totals; unit: state guards.
- **Manual QA:** QA-T-09.
- **DoD:** historical integrity demonstrable.

---

## T-PAY-001 — Payment provider port and fake adapter

- **Requirements:** FR-PAYMENT-001..003, FR-PAYMENT-016
- **Goal:** Define the provider port and implement a **fake** adapter for tests/dev only.
- **ADR:** ADR-0011
- **Product Docs:** `PAYMENTS.md` §2, `SECURITY.md` §5
- **Modules:** `src/server/payments`, `src/domain/payment`
- **Dependencies:** T-SALE-002
- **Behavior:** `createPayment`/`getStatus` shells; fake adapter scriptable (verified, duplicate, mismatch, timeout).
- **Invariants:** no client path to `PAID`; fake adapter cannot be enabled in production.
- **Finance:** isolates future gateway work from the domain.
- **Security:** real credentials never required for tests.
- **Privacy:** provider payloads minimised.
- **Offline:** port calls are online-only by nature.
- **Concurrency:** idempotent creation per `clientPaymentId`.
- **Failures:** timeouts map to `PENDING` + sweep, never success.
- **Tests:** unit: adapter contract tests against the fake; integration: state guards.
- **Manual QA:** reviewer confirms no fake in production path.
- **DoD:** the payment boundary is swappable without touching sales/settlement.

## T-PAY-002 — Static QRIS pending-verification flow

- **Requirements:** FR-CUST-001, FR-PAYMENT-004, FR-PAYMENT-006, FR-PAYMENT-008, FR-PAYMENT-013, NFR-OFFLINE-002
- **Goal:** Record a static-QRIS payment honestly as `PENDING_VERIFICATION` and resolve it via Finance review.
- **ADR:** ADR-0012
- **Product Docs:** `PAYMENTS.md` §5, `DESIGN.md` §3.3
- **Modules:** `src/features/payments`
- **Dependencies:** T-PAY-001
- **Behavior:** operator marks "already paid"; UI says "Menunggu verifikasi"; HQ gets a reconciliation queue row.
- **Invariants:** UI never claims success; digital never confirmed offline.
- **Finance:** explicit unverified balances in closing and dashboards.
- **Security:** cannot be escalated to PAID without human verification + evidence note.
- **Privacy:** none beyond payment metadata.
- **Offline:** payment record may be queued but marked unresolved; **never** verified offline.
- **Concurrency:** duplicate confirms idempotent; one payment per sale.
- **Failures:** verification absent for days ⇒ alert; sale remains visibly unresolved.
- **Tests:** integration: pending → manual verify → PAID with evidence; UI assertions for wording.
- **Manual QA:** QA-T-04, QA-C-06.
- **DoD:** honest digital states enforced by tests.

## T-PAY-003 — Webhook verification and dedupe

- **Requirements:** FR-PAYMENT-005, FR-PAYMENT-012, NFR-SEC-006
- **Goal:** Signature verification, replay window, amount/currency match, dedupe by provider reference.
- **ADR:** ADR-0011
- **Product Docs:** `API.md` §9, `PAYMENTS.md` §8
- **Modules:** `src/server/payments`, `src/app/api/v1/webhooks`
- **Dependencies:** T-PAY-001
- **Behavior:** invalid signature ⇒ 401 + security audit; valid ⇒ process once; duplicate ⇒ no-op; mismatch ⇒ review queue.
- **Invariants:** only verified evidence can move a payment to PAID.
- **Finance:** prevents fake revenue. **Security:** the primary attack surface, explicitly hardened.
- **Privacy:** raw payloads stored encrypted, access-restricted.
- **Offline:** n/a. **Concurrency:** simultaneous duplicate callbacks ⇒ single effect via unique index.
- **Failures:** unknown reference ⇒ investigation queue (never a 500 loop).
- **Tests:** integration: signature invalid, replay, duplicate, amount mismatch, unknown reference.
- **Manual QA:** QA-X-05.
- **DoD:** forging a callback cannot change money.

## T-PAY-004 — Manual reconciliation by HQ Finance

- **Requirements:** FR-PAYMENT-009..010, FR-PAYMENT-015, FR-SETTLE-008
- **Goal:** Finance reconciles payments/settlements with evidence, reason, and audit.
- **ADR:** ADR-0011, ADR-0026
- **Product Docs:** `PAYMENTS.md` §7, `SETTLEMENT.md` §4
- **Modules:** `src/features/payments`, `src/features/hq`
- **Dependencies:** T-PAY-002, T-PAY-003
- **Behavior:** queue of pending/mismatched items; match action requires evidence note; corrects forward only.
- **Invariants:** manual PAID requires role + evidence + audit; no rewriting of past sales.
- **Finance:** makes static QRIS workable. **Security:** segregation of duties (Finance ≠ operator).
- **Privacy:** statement screenshots may contain PII of other customers ⇒ guidance to redact.
- **Offline:** n/a (HQ online).
- **Concurrency:** two reviewers ⇒ single decision (optimistic lock).
- **Failures:** double-match attempt rejected with explanation.
- **Tests:** integration: permission, evidence requirement, audit, double-match.
- **Manual QA:** QA-H-04.
- **DoD:** every digital rupiah has a resolution path with a name attached.

---

## T-EXP-001 — Expense capture (neutral categories)

- **Requirements:** FR-EXPENSE-001..004, FR-EXPENSE-009..010, FR-EXPENSE-012
- **Goal:** Fast expense entry incl. `UNVERIFIED_FIELD_EXPENSE`, offline-capable, with **no recipient or purpose inference**.
- **ADR:** ADR-0027
- **Product Docs:** `EXPENSES.md`, `PRD.md` §9
- **Modules:** `src/features/expenses`, `src/domain/expense`
- **Dependencies:** T-SHIFT-001, T-OFF-001
- **Behavior:** category + amount (+ optional note/photo); reduces expected cash when cash impact applies; visible in shift totals.
- **Invariants:** amount > 0; category from config; no schema field for "who was paid"; no suggestion of amounts.
- **Finance:** expense totals in closing and reporting.
- **Security:** self-scope; no deletion path.
- **Privacy:** notes are personal data; evidence short-lived; **coercion safety** — "I don't know" always allowed.
- **Offline:** queued; local expected-cash maths marked pending.
- **Concurrency:** duplicate submission idempotent by `clientExpenseId`.
- **Failures:** malformed category/amount rejected with clear message; failed sync preserves the record.
- **Tests:** integration: neutral fields exist (schema assertion), idempotency, cash impact, audit.
- **Manual QA:** QA-E-01/02/05.
- **DoD:** expenses are recordable and auditable without endorsing anything.

## T-EXP-002 — Expense review workflow

- **Requirements:** FR-EXPENSE-004..007, `STATE_MACHINE.md` §6
- **Goal:** SUBMITTED → REVIEW_REQUIRED → REVIEWED/REJECTED/ESCALATED with neutral wording.
- **ADR:** ADR-0027
- **Product Docs:** `EXPENSES.md` §5
- **Modules:** `src/features/expenses`, `src/features/hq`
- **Dependencies:** T-EXP-001
- **Behavior:** flag with reason; review/reject with mandatory reason; operator sees status neutrally; escalation routes to a human process.
- **Invariants:** monotonic transitions; no deletion; no automated verdicts.
- **Finance:** review determines reporting recognition, not arithmetic reality.
- **Security:** reviewer ≠ submitter when both roles held.
- **Privacy:** rejection reasons must not require the operator to speculate about recipients.
- **Offline:** operator sees status changes on sync.
- **Concurrency:** review vs operator correction ⇒ review of the latest revision only.
- **Failures:** illegal transitions throw; partial review states impossible.
- **Tests:** integration: each transition, reason enforcement, audit, visibility to operator.
- **Manual QA:** QA-E-03/04.
- **DoD:** HQ can review without accusation and with a full trail.

## T-EXP-003 — Expense flagging rules (patterns, not personalities)

- **Requirements:** FR-EXPENSE-004, FR-EXPENSE-008
- **Goal:** Configurable thresholds/patterns that route expenses to review.
- **ADR:** ADR-0027
- **Product Docs:** `EXPENSES.md` §6/§7
- **Modules:** `src/features/expenses`
- **Dependencies:** T-EXP-002
- **Behavior:** rules evaluate at submission and in nightly aggregation; results are review items with an explanation.
- **Invariants:** rules never reject; only humans decide; rules are visible and tunable; no "suspicion score".
- **Finance:** finds outliers and recurring field costs. **Security:** rule changes audited.
- **Privacy:** aggregated reporting preferred; individual naming only in review context.
- **Offline:** rules apply at sync time (server-side).
- **Concurrency:** rule update mid-batch applies to subsequent evaluations only.
- **Failures:** rule evaluation failure logs and continues (no blocked submissions).
- **Tests:** unit: rule evaluation; integration: routing to review, audit of rule changes.
- **Manual QA:** create a pattern and verify aggregate surfacing, not naming.
- **DoD:** suspicious/unusual expenses are surfaced as questions with evidence, safely.

## T-EXP-004 — Evidence uploads

- **Requirements:** FR-EXPENSE-007, NFR-PERF-008, NFR-SEC-008
- **Goal:** Optional photo evidence via pre-signed uploads with size/type limits and access control.
- **ADR:** ADR-0020
- **Product Docs:** `EXPENSES.md` §8, `SECURITY.md` §6
- **Modules:** `src/server/storage`, `src/features/expenses`
- **Dependencies:** T-EXP-001
- **Behavior:** request pre-signed URL → client compresses → upload → reference stored on the expense.
- **Invariants:** keys unguessable; downloads via short-lived signed URLs; evidence never required.
- **Finance:** supports review. **Security:** content-type/size checks; no executables.
- **Privacy:** short retention; guidance against capturing faces/plates.
- **Offline:** queued separately from the expense record; expense remains valid without it.
- **Concurrency:** duplicate uploads overwrite or create a new object key (last wins), never corrupt.
- **Failures:** upload failure never blocks the expense record.
- **Tests:** integration: URL issuance, limits, access control; browser: offline queue behaviour.
- **Manual QA:** QA-E-06.
- **DoD:** evidence works without becoming mandatory or a privacy hazard.

---

## T-STOCK-001 — Stock catalog and movements

- **Requirements:** FR-STOCK-001..003
- **Goal:** Configurable stock items + append-only movement ledger; derived positions.
- **ADR:** ADR-0030, ADR-0025
- **Product Docs:** `INVENTORY.md` §2/§3
- **Modules:** `src/features/inventory`, `src/domain/inventory`
- **Dependencies:** T-FOUND-006, T-AUTHZ-001
- **Behavior:** record movements (ISSUE/RETURN/WASTE/…/MANUAL_ADJUSTMENT/UNKNOWN); positions computed by aggregation.
- **Invariants:** movements immutable; position never stored as truth (INV-13); adjustment requires reason.
- **Finance:** leakage visibility. **Security:** scope; adjustments audited.
- **Privacy:** business data; operator link only for accountability.
- **Offline:** movements queue with `clientMovementId`.
- **Concurrency:** duplicate movement idempotent; no negative-position corruption from ordering.
- **Failures:** unknown item ⇒ explicit error or "Lainnya" note path, never silent.
- **Tests:** unit: aggregation; integration: idempotency, adjustment reasons, position derivation.
- **Manual QA:** issue stock, count it, verify position.
- **DoD:** stock ledger is provably append-only and derived.

## T-STOCK-002 — Shift snapshots and variance

- **Requirements:** FR-STOCK-004..007, FR-STOCK-011..012
- **Goal:** Start/end counts with expected vs counted variance and reason capture.
- **ADR:** ADR-0030
- **Product Docs:** `INVENTORY.md` §5, `SETTLEMENT.md` §2
- **Modules:** `src/features/inventory`
- **Dependencies:** T-STOCK-001, T-SHIFT-002
- **Behavior:** count entry (fast path), variance computation, reason prompt beyond tolerance, closing integration.
- **Invariants:** variance never accuses (no status change, no sanction); `UNKNOWN` accepted; expectations computed server-side.
- **Finance:** explains stock loss; feeds closing summary.
- **Security:** self-scope; counts audited.
- **Privacy:** variance history visible to the operator themself.
- **Offline:** counts queue; expected values computed on the server after sync.
- **Concurrency:** duplicate end-count reports idempotent; conflicting counts ⇒ latest wins with a note.
- **Failures:** missing counts ⇒ closing flagged partial with HQ visibility.
- **Tests:** integration: variance maths, reason enforcement, no-accusation assertions (no status change), idempotency.
- **Manual QA:** QA-K-02/03.
- **DoD:** every variance is explainable or explicitly unknown.

## T-STOCK-003 — Thresholds and alerts

- **Requirements:** FR-NOTIF-001, FR-STOCK-008
- **Goal:** Low/critical thresholds producing `STOCK_LOW` / `STOCK_CRITICAL` alerts.
- **ADR:** ADR-0030
- **Product Docs:** `INVENTORY.md` §6, `NOTIFICATIONS.md` §2
- **Modules:** `src/features/inventory`, `src/features/hq`
- **Dependencies:** T-STOCK-001
- **Behavior:** band evaluation on position changes; dedupe; actionable alerts for Ops/warehouse.
- **Invariants:** alerts never block selling; thresholds are configuration; expiry when condition clears.
- **Finance:** avoids lost sales. **Security:** threshold edits audited.
- **Privacy:** none. **Offline:** alerts evaluated server-side; operator sees prompts after sync.
- **Concurrency:** alert dedupe keyed by item+stall+band.
- **Failures:** threshold misconfiguration surfaces as validation error, not silence.
- **Tests:** integration: band transitions, dedupe, auto-expiry.
- **Manual QA:** drive a item to critical; verify the alert and the suggested action.
- **DoD:** alerts are useful and rare enough to matter.

## T-STOCK-004 — Transfers and restock requests

- **Requirements:** FR-STOCK-009, `STATE_MACHINE.md` §7
- **Goal:** REQUESTED → ISSUED → RECEIVED → RECONCILED flow with both-side confirmation.
- **ADR:** ADR-0030
- **Product Docs:** `INVENTORY.md` §4
- **Modules:** `src/features/inventory`
- **Dependencies:** T-STOCK-001
- **Behavior:** operator requests; warehouse issues; operator receives; discrepancies recorded with reason.
- **Invariants:** receiving more than issued requires an explicit discrepancy record; cancellations require reasons.
- **Finance:** stock custody boundaries. **Security:** warehouse role scope.
- **Privacy:** none. **Offline:** request/receive queue; issue requires warehouse connectivity.
- **Concurrency:** two receipts for one transfer ⇒ idempotent.
- **Failures:** partial dispatch recorded as such; no silent quantity edits.
- **Tests:** integration: full flow, discrepancy path, idempotency, cancellation.
- **Manual QA:** QA-K-05 plus a discrepancy case.
- **DoD:** custody of stock is traceable end-to-end.

---

## T-CLOSE-001 — Shift closing summary

- **Requirements:** FR-CASH-005, FR-SETTLE-001..003, FR-SHIFT-004, FR-SHIFT-006, FR-SHIFT-008
- **Goal:** Build the closing summary: gross sales, payment mix, expenses, expected cash, counted cash, variance, stock variances.
- **ADR:** ADR-0006, ADR-0033
- **Product Docs:** `SETTLEMENT.md` §2/§3, `API.md` §13
- **Modules:** `src/features/shifts`, `src/domain/shift`
- **Dependencies:** T-SALE-002, T-EXP-001, T-STOCK-002
- **Behavior:** prepare summary → operator confirms count → submit → immutable closing record.
- **Invariants:** expected cash = opening + cash sales − cash expenses; digital verified vs unverified separated; stored at closing (not recomputed later).
- **Finance:** the primary reconciliation artefact. **Security:** self-scope; corrections need Finance.
- **Privacy:** none beyond operator accountability data.
- **Offline:** computed locally for display; server recomputes on acceptance.
- **Concurrency:** closing while sales pending ⇒ submission reports missing client IDs and refuses to finalise.
- **Failures:** arithmetic mismatch between device preview and server ⇒ server wins, difference explained.
- **Tests:** unit: cash maths matrix; integration: closing acceptance, missing-sale refusal, immutability.
- **Manual QA:** QA-C-01.
- **DoD:** every closed shift has a defensible cash statement.

## T-CLOSE-002 — Variance handling and review

- **Requirements:** FR-CASH-004, FR-CASH-006, FR-SETTLE-004, FR-SHIFT-011, FR-SHIFT-015, NFR-UX-006
- **Goal:** Out-of-tolerance variance requires a reason or review; neutral wording; no auto write-off.
- **ADR:** ADR-0026
- **Product Docs:** `SETTLEMENT.md` §2/§6, `DESIGN.md` §3.6
- **Modules:** `src/features/shifts`, `src/features/hq`
- **Dependencies:** T-CLOSE-001
- **Behavior:** tolerance configurable; reason from a controlled list incl. `UNKNOWN` and `WILL_RECOUNT`; HQ queue entry; Finance review with note.
- **Invariants:** variance never alters recorded sales; no automatic accusation or sanction (FR-PERF-004).
- **Finance:** variance reporting and pattern analytics. **Security:** reviewer permissions; audit.
- **Privacy:** variance data is personal-adjacent; visible to the operator and the chain only.
- **Offline:** reasons captured offline; review online.
- **Concurrency:** review vs late sale ⇒ late sale creates an exception, review stays valid.
- **Failures:** missing reason blocks acceptance with a clear message (never a silent variance).
- **Tests:** integration: tolerance bands, reason enforcement, `UNKNOWN` path, audit, no-sanction assertion.
- **Manual QA:** QA-C-02, QA-C-05.
- **DoD:** variances are resolved honestly, never hidden.

## T-CLOSE-003 — Offline closing (PENDING_SYNC)

- **Requirements:** FR-SHIFT-007, FR-SHIFT-009, NFR-OFFLINE-009
- **Goal:** A closing submitted offline remains editable and explicitly not "closed" until accepted.
- **ADR:** ADR-0017
- **Product Docs:** `OFFLINE.md` §2/§7, `STATE_MACHINE.md` §1
- **Modules:** `src/features/shifts`, `src/features/offline`
- **Dependencies:** T-CLOSE-001, T-OFF-001
- **Behavior:** device stores PENDING_SYNC; HQ shows partial; acceptance transitions to CLOSED and locks.
- **Invariants:** no UI claim of "closed" before server acceptance; accepted closing is immutable.
- **Finance:** prevents phantom closings. **Security:** replays idempotent by `clientClosingId`.
- **Privacy:** none beyond existing.
- **Offline:** the point of the task.
- **Concurrency:** closing + late sale ⇒ server refuses final acceptance until resolved.
- **Failures:** rejection lists exactly what must be fixed.
- **Tests:** integration: pending semantics, editability, acceptance lock, rejection paths; e2e: QA-C-03.
- **Manual QA:** QA-C-03, QA-O-01.
- **DoD:** the word "closed" is never displayed for an unaccepted closing.

## T-CLOSE-004 — Day roll-up and lock

- **Requirements:** FR-HQ-005, FR-SETTLE-007, FR-SETTLE-010, `STATE_MACHINE.md` §12
- **Goal:** Area/business-day aggregation, review, lock; corrections forward-only.
- **ADR:** ADR-0026, ADR-0033
- **Product Docs:** `SETTLEMENT.md` §5
- **Modules:** `src/features/hq`, jobs
- **Dependencies:** T-CLOSE-001, T-HQ-002
- **Behavior:** nightly job aggregates accepted closings; open shifts must be closed or marked `CLOSING_EXCEPTION` with reason and owner; Supervisor/HQ sign-off; lock.
- **Invariants:** locked days immutable; corrections are new audited records; roll-up stores `computedAt` + included shift list.
- **Finance:** the management view of a day. **Security:** sign-off permission + audit.
- **Privacy:** aggregates only in HQ views; no staff-surveillance metrics.
- **Offline:** n/a. **Concurrency:** late-arriving closing after lock ⇒ adjustment record, never a rewrite.
- **Failures:** roll-up job failure alerts; partial roll-ups flagged as incomplete.
- **Tests:** integration: roll-up correctness, exception path, lock immutability, late-arrival adjustment.
- **Manual QA:** QA-C-04, QA-H-05.
- **DoD:** a day can be locked and defended.

---

## T-HQ-002 — Read models for HQ cards

- **Requirements:** FR-HQ-001..011, NFR-PERF-006
- **Goal:** Precomputed, idempotently rebuildable read models with `computedAt` + `sourceWatermark`.
- **ADR:** ADR-0018 (jobs), ADR-0022
- **Product Docs:** `ARCHITECTURE.md` §7, `HQ.md` §5
- **Modules:** `src/features/hq`, `src/server/jobs`
- **Dependencies:** T-CLOSE-001, T-EXP-001, T-STOCK-003
- **Behavior:** jobs aggregate per area/day; rebuildable from facts; freshness surfaced.
- **Invariants:** read models never become a source of truth; rebuild yields identical results (test).
- **Finance:** timely, correct management numbers. **Security:** scoped reads.
- **Privacy:** aggregates must not expose individual-sensitive detail to unauthorised roles (NFR-OBS-005).
- **Offline:** n/a. **Concurrency:** overlapping rebuilds idempotent; no double counting.
- **Failures:** stale/unavailable read model ⇒ explicit degraded state.
- **Tests:** integration: rebuild determinism, freshness fields, correctness vs raw facts at seeded scale.
- **Manual QA:** QA-H-01/08.
- **DoD:** HQ cards render within budget at 2,000-stall seeded volume.

## T-HQ-003 — Dashboard cards and drill-down

- **Requirements:** FR-HQ-012..013, `docs/product/HQ-DASHBOARD.md`
- **Goal:** The ten cards with exception-first ordering, two-click drill-down, and export.
- **ADR:** ADR-0021 (export audit)
- **Product Docs:** `docs/product/HQ-DASHBOARD.md`, `DESIGN.md` §4
- **Modules:** `src/features/hq`, `src/app/hq/*`
- **Dependencies:** T-HQ-002
- **Behavior:** cards (Active Operators, Active Selling Points, Today's Gross, Net After Expenses, Digital (verified vs unverified), Cash, Stock Alerts, Unclosed Shifts, Operational Alerts, Location Changes).
- **Invariants:** digital verified and unverified never merged; every number drills to records; exports audited.
- **Finance:** the operational truth surface. **Security:** scope + masking.
- **Privacy:** operator names only where operationally required; no surveillance tiles.
- **Offline:** n/a. **Concurrency:** export while data changes ⇒ snapshot timestamp recorded.
- **Failures:** card error states are explicit and non-misleading.
- **Tests:** e2e: card rendering, drill-down, export audit, freshness badges.
- **Manual QA:** QA-H-01/02/06.
- **DoD:** HQ can understand the network in a 30-second glance.

---

## T-LOY-001 — Customer identification with consent

- **Requirements:** FR-LOYALTY-001, NFR-PRIVACY-006
- **Goal:** Phone/QR/device-token identification with explicit, recorded, purpose-bound consent.
- **ADR:** ADR-0028
- **Product Docs:** `LOYALTY.md` §2/§7, `API.md` §15
- **Modules:** `src/features/loyalty`, `src/domain/loyalty`
- **Dependencies:** T-SALE-001
- **Behavior:** identify → account resolve/create with consent; masked phone returned; no sale blocked by identity.
- **Invariants:** no account without recorded opt-in; identifiers hashed where possible; rate limits per identifier.
- **Finance:** none directly. **Security:** token possession required; rate limits against enumeration.
- **Privacy:** purpose binding; separate consent for campaign messages; withdrawal supported.
- **Offline:** refused (server-required) with a clear message.
- **Concurrency:** simultaneous identify for the same phone ⇒ single account (unique constraint).
- **Failures:** consent missing ⇒ `451` with explanation, not silent creation.
- **Tests:** integration: consent enforcement, duplicate account prevention, rate limits, masking.
- **Manual QA:** identify a customer with and without consent.
- **DoD:** loyalty is opt-in and honest about it.

## T-LOY-002 — Earning

- **Requirements:** FR-LOYALTY-003, FR-LOYALTY-009
- **Goal:** Idempotent earn keyed by sale reference (algorithm deferred to an explicit ADR).
- **ADR:** ADR-0028
- **Product Docs:** `LOYALTY.md` §4/§5
- **Modules:** `src/features/loyalty`
- **Dependencies:** T-LOY-001
- **Behavior:** earn on completed sale; ledger-style transactions; balance derived.
- **Invariants:** earn idempotent per sale; balances derived, never a mutable counter of truth.
- **Finance:** none. **Security:** server-only accrual. **Privacy:** no profile enrichment.
- **Offline:** earn evaluated at sync (sale replay triggers exactly one earn).
- **Concurrency:** replay + concurrent sync ⇒ single earn.
- **Failures:** accrual failure logs and retries; never blocks the sale.
- **Tests:** integration: idempotency, derived balance, no double earn on replay.
- **Manual QA:** verify one earn per sale on repeated sync.
- **DoD:** earning cannot be inflated by network behaviour.

## T-LOY-003 — Rewards and single-use redemption

- **Requirements:** FR-LOYALTY-004, `STATE_MACHINE.md` §10
- **Goal:** Reward instances with single-use redemption and sale-linked adjustments.
- **ADR:** ADR-0028
- **Product Docs:** `LOYALTY.md` §4/§6, `API.md` §16
- **Modules:** `src/features/loyalty`, `src/features/sales`
- **Dependencies:** T-LOY-002, T-SALE-001
- **Behavior:** issue instance → redeem with sale reference → adjustment recorded → instance consumed.
- **Invariants:** single-use enforced by unique constraint; adjustment is a sale adjustment, never a price edit.
- **Finance:** discounts visible in reporting. **Security:** online verification default; conflict ⇒ clean failure.
- **Privacy:** redemption does not require extra personal data.
- **Offline:** refused by default (policy per ADR-0028) with a clear message.
- **Concurrency:** concurrent redemption ⇒ one success, one "already used".
- **Failures:** expired/cancelled instances rejected with reasons.
- **Tests:** integration: concurrent redemption, replay, expired instance, adjustment correctness.
- **Manual QA:** attempt a double redemption on two devices.
- **DoD:** double redemption is impossible by construction.

---

## T-COMM-001 — Operational message threads

- **Requirements:** FR-COMM-001..006
- **Goal:** Anchored threads (area/stall/shift/location/incident) with structured signals and ack.
- **ADR:** ADR-0021
- **Product Docs:** `COMMUNICATION.md`
- **Modules:** `src/features/communications`
- **Dependencies:** T-SHIFT-001, T-LOC-005
- **Behavior:** quick-signal composer; structured payloads; urgent notice requires ack; ops timeline.
- **Invariants:** financial records never live in messages; neutral wording for sensitive reports; no general chat.
- **Finance:** none (references only). **Security:** thread scope inheritance.
- **Privacy:** no PII dumping; message retention per policy.
- **Offline:** posts queue; reads cached; no read-receipt pressure.
- **Concurrency:** duplicate posts idempotent by `clientMessageId`.
- **Failures:** undelivered urgent notices escalate to another channel after a timeout.
- **Tests:** integration: signal payloads, ack tracking, scope isolation, idempotency.
- **Manual QA:** verify the ops timeline explains a day in one screen.
- **DoD:** operational signal capture works without becoming WhatsApp.

## T-ALERT-001 — Alert catalogue and inbox

- **Requirements:** FR-NOTIF-001..008
- **Goal:** Implement the alert catalogue with dedupe, rate limits, ack, escalation, quiet hours.
- **ADR:** ADR-0021
- **Product Docs:** `NOTIFICATIONS.md`
- **Modules:** `src/features/hq`, `src/server/jobs`
- **Dependencies:** T-HQ-002
- **Behavior:** rules/jobs raise alerts; in-app inbox; ack per role; expiry on condition clear.
- **Invariants:** every alert actionable; no money state depends on delivery (FR-NOTIF-007); no suspect naming (FR-NOTIF-008).
- **Finance:** makes exceptions visible in time. **Security:** alert-config changes audited.
- **Privacy:** alerts name objects, not accused people.
- **Offline:** HQ online; operator-facing alerts appear on sync.
- **Concurrency:** dedupe keys prevent storms.
- **Failures:** alert generation failure logs and retries; a missing alert must never hide a condition from dashboards too.
- **Tests:** integration: dedupe, rate limits, ack/escalation, expiry, wording assertions.
- **Manual QA:** trigger each catalogue entry in staging; confirm actionability.
- **DoD:** HQ works from the inbox; nothing important lives only in a graph.

---

## T-TRAFFIC-001 — Human traffic video sampling

- **Status:** NOT DONE — implementation and privacy/runtime evidence pending.
- **Requirements:** FR-TRAFFIC-001, NFR-PRIVACY-012, ADR-0040, R-26, R-27.
- **Scope:** `/operator/traffic-sampling`; authenticated current-outlet context; explicit silent video capture ≤10 seconds; private upload/status; manual count/band and bounded note; sample history and privacy-safe aggregate analytics.
- **Invariants:** no camera on page load; no audio, identity/face recognition, CV, third-party processor or model training; HQ cannot access raw clips; raw objects and backups are deleted within 24 hours; result rows are not keyed to operator/shift; production flag remains off until DPIA/privacy approval and purge/backup deletion are verified.
- **Tests:** unit and integration tests for camera/upload gates, size/type/duration validation, auth/scope, count/band validation, history isolation, idempotency, cleanup and analytics redaction; browser proof remains required.
- **Dependencies:** active operator outlet context and private media storage; production release blocked on approved DPIA, real private storage, scheduled purge plus backup expiry evidence.

## T-SITE-001 — Weather & site suitability

- **Status:** NOT DONE — weather source, browser acceptance, production persistence and retention gates remain incomplete.
- **Requirements:** FR-SITE-001..003; canonical prompt `docs/product/end-to-end-pages/12-weather-site-suitability.md`.
- **Scope:** `/operator/site-condition`; current active-site context; manual wet/dry and shelter observation; bounded shelter/relocation decision notes; recent site observations; clearly scoped traffic and shift sales; transparent weather-unavailable state and non-binding observation-only cue.
- **Invariants:** no fabricated weather; no third-party weather calls or GPS forwarding; current shift/site derived server-side; notes are bounded and excluded from telemetry; cue is not a forecast, safety certification, or automatic move.
- **Tests:** adapter missing-weather fallback, cue freshness/decision rules, auth/scope, validation, idempotency, persistence/history and analytics redaction; browser proof remains required.
- **Dependencies:** active location/shift context; Page 11 traffic is optional and remains production-gated; production release requires an approved weather provider/data flow, real auth/database and verifiable scheduled retention/backup controls.

## T-INC-001 — Incident capture

- **Status:** PARTIAL — Page 13 neutral online capture and self-scoped API are implemented; acceptance and release gates remain open.
- **Requirements:** FR-INC-001..002, FR-INC-004, FR-INC-011..013
- **Goal:** Fast neutral report capture with optional operator urgency hint/amount, server-derived shift/location, self-only history, and no unsupported evidence claims.
- **ADR:** ADR-0027 (neutrality posture)
- **Product Docs:** `INCIDENTS.md`, `docs/integration/13-security-incident-ground-truth.md`, `docs/integration/13-security-incident-architecture.md`
- **Modules:** `src/features/incidents`, `/operator/incidents/new`, `/api/v1/incidents`
- **Dependencies:** T-SHIFT-001; T-EXP-004 is not used for incident evidence in this pilot.
- **Behavior:** report → `SUBMITTED`; no assigned severity, legal finding, automatic escalation or owner is claimed. Actor/org and optional current shift/site are server-derived.
- **Invariants:** neutral report categories; no client scope fields or involved-person identity; direct cross-operator/cross-tenant detail returns 404; bounded narratives excluded from audit summaries and telemetry.
- **Finance:** optional amount is an operator-reported IDR value/context only, not verified financial data. **Security:** evidence upload is unavailable.
- **Privacy:** reporter-only history; production retention/deletion and durable auth/storage controls remain unverified.
- **Offline:** existing `submitIncident` queue path must remain intact; contract mapping and device-time semantics still need dedicated verification.
- **Concurrency:** scoped duplicate idempotency by `clientIncidentId`; tests cover same-key replay and changed content.
- **Failures:** invalid category/time/amount/key rejected; app must never claim to be an emergency channel.
- **Tests:** `tests/unit/incident-report.test.ts` and `tests/integration/incident-report-api.test.ts`; offline, persistence restart, migration and runtime/browser acceptance remain open.
- **Manual QA:** operator browser acceptance and direct URL authorization proof pending.
- **DoD:** NOT MET until open evidence and production gates in `docs/integration/13-security-incident-gap-report.md` are closed.

## T-INC-002 — Incident lifecycle and escalation

- **Requirements:** FR-INC-003..006, `STATE_MACHINE.md` §11
- **Goal:** OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED with SLAs, owners, trends.
- **ADR:** ADR-0026
- **Product Docs:** `INCIDENTS.md` §4/§6
- **Modules:** `src/features/incidents`, `src/features/hq`
- **Dependencies:** T-INC-001, T-ALERT-001
- **Behavior:** owner assignment, SLA timers, reopen with reason, trend analytics, equipment watchlist.
- **Invariants:** lifecycle monotonic aside from audited reopen; resolution note required; no delete.
- **Finance:** trend cost visibility (via linked expenses). **Security:** responder-scoped access.
- **Privacy:** involved-person data restricted; never public.
- **Offline:** HQ online; operator sees status changes on sync.
- **Concurrency:** two responders ⇒ single owner (claim/lock semantics).
- **Failures:** SLA breach raises an alert rather than silently ageing.
- **Tests:** integration: transitions, SLA alerts, reopen audit, trend aggregation.
- **Manual QA:** run a P1 through to resolution and check the audit trail.
- **DoD:** incidents produce fixes, not just records.

---

## T-PERF-001 — Metric snapshots (multi-factor)

- **Requirements:** FR-PERF-001, FR-PERF-004, FR-PERF-008..009
- **Goal:** Compute and store per-period metric snapshots for operators, reproducible from facts.
- **ADR:** ADR-0029
- **Product Docs:** `PERFORMANCE.md` §2/§7
- **Modules:** `src/features/performance`, jobs
- **Dependencies:** T-CLOSE-001, T-STOCK-002, T-ALERT-001
- **Behavior:** nightly/weekly computation of the M-1…M-15 catalogue (with formulas documented); versioned `metricVersion`.
- **Invariants:** no surveillance metrics (idle time, movement, tap speed) exist; reproducible recomputation; formula changes versioned.
- **Finance:** contextual business insight. **Security:** scoped access; no cross-operator leakage.
- **Privacy:** work data only; visible to the operator themself.
- **Offline:** n/a. **Concurrency:** recomputation idempotent per period.
- **Failures:** partial data ⇒ snapshot marked provisional, not guessed.
- **Tests:** unit: formula cases; integration: reproducibility, versioning, exclusion of disrupted shifts.
- **Manual QA:** recompute a period and compare to the stored snapshot.
- **DoD:** metrics are defensible and reproducible.

## T-PERF-002 — Normalisation and operator-facing breakdown

- **Requirements:** FR-OPERATOR-010, FR-PERF-002
- **Goal:** Compare against location baselines (traffic, weekday, window) and show the operator their own factor breakdown with explanations.
- **ADR:** ADR-0029
- **Product Docs:** `PERFORMANCE.md` §4/§6
- **Modules:** `src/features/performance`, `src/app/*`
- **Dependencies:** T-PERF-001
- **Behavior:** baseline delta, confidence band, sample size; operator screen explains each factor in plain language.
- **Invariants:** no revenue-only ranking exists anywhere; comparisons always show adjustments or are omitted; no publicly exposed per-operator ratings.
- **Finance:** fair management view. **Security:** self-scope for operators.
- **Privacy:** no comparative shame; peer comparisons only anonymised and opt-in per deployment.
- **Offline:** operator breakdown cached read-only.
- **Concurrency:** baseline recomputation idempotent.
- **Failures:** insufficient sample ⇒ "belum cukup data" instead of a misleading number.
- **Tests:** integration: baseline maths, confidence display, ranking-absence assertion (no revenue-only sort).
- **Manual QA:** verify a quiet-location operator can be recognised fairly (with VS-15).
- **DoD:** fairness is visible in the numbers and in the words.

---

## T-REC-001 — Recognition period computation

- **Requirements:** FR-RECOG-002..004, FR-RECOG-006..007
- **Goal:** Multi-factor, normalised, published-weights scoring producing a provisional result with a factor breakdown.
- **ADR:** ADR-0029
- **Product Docs:** `docs/product/OPERATOR-RECOGNITION.md`
- **Modules:** `src/features/performance`
- **Dependencies:** T-PERF-002
- **Behavior:** compute scores per category (Day/Month/Year) using published weights; store factor contributions; produce review-ready output.
- **Invariants:** weights published before the period; no revenue-only ranking; no hidden AI; low-traffic operators can win; every score reproducible.
- **Finance:** motivation and fairness, not punishment. **Security:** computation server-side; weights change audited.
- **Privacy:** factor breakdown visible only to the operator and reviewers.
- **Offline:** n/a. **Concurrency:** recomputation idempotent; a frozen period cannot be silently recomputed.
- **Failures:** missing factor data ⇒ documented imputation or exclusion, never invention.
- **Tests:** unit: scoring with synthetic profiles across traffic tiers; integration: reproducibility, weight-change audit.
- **Manual QA:** review a month's provisional ranking for plausibility and fairness.
- **DoD:** the result can be explained line by line to an operator.

## T-REC-002 — Review, override, and publication

- **Requirements:** FR-RECOG-005
- **Goal:** Human approval gate; overrides with reasons; publication with operator-visible breakdown and a dispute window.
- **ADR:** ADR-0029
- **Product Docs:** `docs/product/OPERATOR-RECOGNITION.md`
- **Modules:** `src/features/performance`, `src/features/hq`
- **Dependencies:** T-REC-001
- **Behavior:** provisional → review → approve/override (reason + actor + audit) → publish; operators see their own breakdown.
- **Invariants:** no auto-publication; overrides mandatory-audit; results immutable after lock (new results require a new period review).
- **Finance:** recognition budget/tokens handled outside the system, referenced only. **Security:** approval roles restricted.
- **Privacy:** publication shows name + category only with the operator's knowledge; no comparative shaming.
- **Offline:** operators see results on sync.
- **Concurrency:** two reviewers ⇒ single decision (lock).
- **Failures:** publication failure reverts to provisional state, not a broken view.
- **Tests:** integration: approval gate, override audit, publication visibility, immutable-after-lock.
- **Manual QA:** run a full monthly cycle in staging with a dispute simulation.
- **DoD:** recognition is transparent, reviewable, and fair.

---

## T-OFF-002 — Service worker and offline shell

- **Requirements:** NFR-OFFLINE-003, NFR-PERF-001
- **Goal:** Serwist-based app shell caching, offline page, and update policy that never reloads mid-shift.
- **ADR:** ADR-0005, ADR-0017
- **Product Docs:** `OFFLINE.md` §3/§8, `docs/research/STACK-2026.md` §2.2
- **Modules:** client shell, `next.config`, service worker source
- **Dependencies:** T-SALE-003
- **Behavior:** precache shell + critical assets; runtime caching for read APIs with staleness markers; update deferred until the shift ends.
- **Invariants:** no background sync loops; no periodic sync; no hidden data prefetch of personal data.
- **Finance:** availability of the money path offline. **Security:** cache must not store sensitive pages after logout (purge on logout).
- **Privacy:** no passive collection by the worker.
- **Offline:** the point of the task; also must handle half-updated caches safely.
- **Concurrency:** two tabs updating ⇒ single activation; no data loss.
- **Failures:** broken SW must not brick the app: failsafe bypass + version pinning + recovery instructions.
- **Tests:** browser/e2e: offline navigation, cache purge on logout, update deferral during shift.
- **Manual QA:** QA-O-01/03 with a real device.
- **DoD:** offline shell works and never surprises an operator mid-shift.

## T-OFF-003 — Quarantine and conflict UX

- **Requirements:** FR-SALE-003, NFR-OFFLINE-006
- **Goal:** Quarantine corrupted queue entries, export them for support, and surface conflicts clearly.
- **ADR:** ADR-0017
- **Product Docs:** `OFFLINE.md` §7/§9
- **Modules:** `src/features/offline`, support tooling
- **Dependencies:** T-OFF-001
- **Behavior:** validation on read; quarantine store; support export (JSON, no PII beyond the record); conflict screens with plain explanations and next steps.
- **Invariants:** no silent drop; export is user-initiated at the service-desk level; conflicts never resolved by guessing.
- **Finance:** protects records. **Security:** export requires operator/support roles; contains only affected records.
- **Privacy:** quarantined data stays on device unless exported deliberately.
- **Offline:** the quarantine lives offline; export happens when online.
- **Concurrency:** quarantine writes are atomic; no partial exports.
- **Failures:** quarantine itself failing ⇒ loud error + instructions (never silent).
- **Tests:** integration/browser: corruption injection, quarantine, export payload shape, conflict screens.
- **Manual QA:** QA-O-05.
- **DoD:** no record can vanish without a trace.

## T-OFF-004 — Stale-data policy enforcement

- **Requirements:** FR-MENU-007, FR-PRICE-010, NFR-OFFLINE-003
- **Goal:** Enforce soft/hard staleness rules for prices, menu, locations, stock items, assignments.
- **ADR:** ADR-0008, ADR-0017
- **Product Docs:** `OFFLINE.md` §8
- **Modules:** `src/features/offline`, `src/features/pricing`
- **Dependencies:** T-PRICE-003, T-OFF-002
- **Behavior:** freshness markers (fresh/amber/red); hard-stale blocks selling unpriced items; soft-stale requires confirmation; every display shows the data's own timestamp.
- **Invariants:** the client never invents a price (NFR-OFFLINE-010); no silent stale snapshot.
- **Finance:** prevents mispricing. **Security:** n/a. **Privacy:** none.
- **Offline:** the point of the task.
- **Concurrency:** price change during a stale sale ⇒ server mismatch path.
- **Failures:** unknown freshness (clock issues) treated as stale (fail safe).
- **Tests:** unit: staleness bands; integration: block/confirm paths; e2e: QA-T-07, QA-O-06.
- **Manual QA:** QA-T-07.
- **DoD:** stale data is always visible and never silently used.

---

## T-SEC-001 — Real authentication (Better Auth)

- **Requirements:** FR-OPERATOR-012, NFR-SEC-001
- **Goal:** Replace the fake auth provider with real sessions: phone+OTP for operators, password+2FA for HQ.
- **ADR:** ADR-0015
- **Product Docs:** `SECURITY.md` §3
- **Modules:** `src/server/auth`
- **Dependencies:** T-FOUND-005, T-SEC-002
- **Behavior:** OTP issuance/verification with rate limits; session lifecycle; revocation; device labels.
- **Invariants:** no default actor; revocation effective immediately; no account enumeration.
- **Finance:** access control foundation. **Security:** OTP brute-force limits; session fixation prevention.
- **Privacy:** phone numbers stored as needed for authentication; logs masked.
- **Offline:** long-lived operator sessions; cached session validated on reconnect; revocation honoured then.
- **Concurrency:** multiple OTP requests ⇒ single active code.
- **Failures:** SMS/WhatsApp provider outage ⇒ documented fallback (supervisor-assisted re-bind).
- **Tests:** integration: OTP flows, lockouts, revocation, role gate; e2e: login journeys.
- **Manual QA:** device loss and re-bind procedure.
- **DoD:** authentication is real, tested, and recoverable.

## T-SEC-002 — Finance hardening and segregation of duties

- **Requirements:** FR-PAYMENT-010, NFR-SEC-002, `docs/security/PERMISSIONS.md`
- **Goal:** Enforce segregation (reviewer ≠ submitter, reconciler ≠ operator), mandatory 2FA for Finance/Owner, reason requirements.
- **ADR:** ADR-0016, ADR-0026
- **Product Docs:** `SECURITY.md` §4, `docs/finance/*`
- **Modules:** `src/server/auth`, `src/features/hq`
- **Dependencies:** T-SEC-001, T-PAY-004, T-EXP-002
- **Behavior:** policies enforced in code + tests; violations blocked with explanation; audit for privileged actions.
- **Invariants:** privileged money actions always carry actor + reason; no self-approval where prohibited.
- **Finance:** the heart of integrity. **Security:** least privilege; break-glass procedure documented.
- **Privacy:** reviewer identity visible in audit, not publicly.
- **Offline:** n/a (HQ actions online).
- **Concurrency:** simultaneous approvals ⇒ single decision.
- **Failures:** policy engine errors fail closed.
- **Tests:** integration: each prohibition; audit presence; 2FA enforcement.
- **Manual QA:** attempt self-approval as a dual-role user; verify block.
- **DoD:** privileges are limited, separated, and provable.

## T-OPS-001 — Retention jobs and data-subject tooling

- **Requirements:** FR-EXPENSE-014, NFR-PRIVACY-007
- **Goal:** Scheduled retention jobs, deletion/anonymisation tooling, DSAR workflow, 72-hour breach support.
- **ADR:** ADR-0037
- **Product Docs:** `RETENTION.md`, `PRIVACY.md` §4/§6
- **Modules:** `src/server/jobs`, `src/features/privacy`
- **Dependencies:** T-SEC-001
- **Behavior:** dry-run + bounded deletion; per-entity handlers; DSAR export/delete; breach checklist tooling.
- **Invariants:** deletions bounded by policy; audit of deletion actions; legal holds respected.
- **Finance:** financial retention preserved while personal data is minimised.
- **Security:** retention tooling is privileged and audited. **Privacy:** the point of the task.
- **Offline:** n/a. **Concurrency:** job re-entrancy safe (idempotent).
- **Failures:** deletion failure alerts loudly; silent non-deletion is a compliance bug.
- **Tests:** integration: each handler with fixtures; hold behaviour; DSAR export redaction.
- **Manual QA:** dry-run a deletion cycle on staging and inspect the log.
- **DoD:** retention is enforceable, observable, and provable.

---

## T-OBS-001 — OpenTelemetry pipeline and dashboards

- **Requirements:** NFR-OBS-001..003
- **Goal:** OTLP export, Collector, Prometheus/Tempo/Loki/Grafana, business + technical metrics, dashboards.
- **ADR:** ADR-0022
- **Product Docs:** `OBSERVABILITY.md` §2/§5
- **Modules:** `src/server/telemetry`
- **Dependencies:** T-CLOSE-001, T-PAY-003
- **Behavior:** instrument handlers, use cases, jobs, adapters; dashboards per audience.
- **Invariants:** no PII in telemetry; bounded labels; sampling for traces, not for error signals.
- **Finance:** money-path visibility. **Security:** telemetry access control; no secrets in spans.
- **Privacy:** masking by default; short retention.
- **Offline:** client metrics batch and buffer offline.
- **Concurrency:** n/a. **Failures:** telemetry outage must never break the app path (non-blocking exporters).
- **Tests:** integration: span presence for key flows; unit: label allow-list.
- **Manual QA:** answer "why did this sale fail?" from traces in ≤ 5 min.
- **DoD:** the pilot can be operated from dashboards.

## T-OBS-002 — SLOs, alert routing, and runbook linkage

- **Requirements:** NFR-OBS-004
- **Goal:** Wire SLIs/SLOs, infrastructure alerts, and mandatory runbook links.
- **ADR:** ADR-0022
- **Product Docs:** `OBSERVABILITY.md` §4/§6, `RUNBOOK.md`
- **Modules:** `src/server/telemetry`, `docs/operations`
- **Dependencies:** T-OBS-001
- **Behavior:** error-budget tracking; alerts reference runbook sections; escalation paths.
- **Invariants:** every alert has a first action; alerts without runbooks are rejected in review.
- **Finance:** protects reconciliation flows. **Security:** alert content free of PII.
- **Privacy:** no individual detail in pages.
- **Offline:** n/a. **Concurrency:** n/a.
- **Failures:** alert delivery failure for P1 ⇒ secondary channel (documented).
- **Tests:** config tests: every alert rule links to an existing runbook anchor.
- **Manual QA:** fire a synthetic alert; confirm the runbook path.
- **DoD:** alerts lead to action, not confusion.

---

## T-OPS-002 — Deployment pipeline

- **Requirements:** NFR-OPS-001..003, NFR-REL-006
- **Goal:** Immutable images, explicit migration step, rolling deploy, instant rollback.
- **ADR:** ADR-0024
- **Product Docs:** `DEPLOYMENT.md`
- **Modules:** `.github/workflows`, Dockerfile, ops scripts
- **Dependencies:** T-FOUND-001
- **Behavior:** build → scan → push → migrate → deploy → health check → traffic; rollback by tag.
- **Invariants:** no build-on-server; no `drizzle-kit push` to shared environments; migrations reviewed by a human.
- **Finance:** safe releases for money paths. **Security:** secrets injected at runtime; image scanning gating.
- **Privacy:** environments separated; no production data in staging.
- **Offline:** rolling deploy must not lose queued device data (server may reject temporarily; clients retry).
- **Concurrency:** migration during traffic ⇒ expand/contract pattern (additive first).
- **Failures:** failed health check ⇒ automatic rollback; degraded mode documented.
- **Tests:** CI pipeline dry-run; staging deploy; rollback drill.
- **Manual QA:** deploy and roll back with an operator mid-shift (on staging).
- **DoD:** deploys are boring, reversible, ≤ 10 minutes.

## T-OPS-003 — Backups and restore drills

- **Requirements:** NFR-REL-002
- **Goal:** Automated backups with tested restore, RPO ≤ 5 min, RTO ≤ 4 h.
- **ADR:** ADR-0024
- **Product Docs:** `OPERATIONS.md`, `RUNBOOK.md`
- **Modules:** ops
- **Dependencies:** T-OPS-002
- **Behavior:** PITR on managed Postgres; object storage versioning where available; quarterly restore rehearsal with evidence.
- **Invariants:** restore drill must reconcile a sample of shifts/sales after restore (data integrity check).
- **Finance:** protects the books. **Security:** backups encrypted, access-restricted.
- **Privacy:** backups included in retention policy; deletion propagates on rotation.
- **Offline:** n/a. **Concurrency:** n/a.
- **Failures:** backup failure alerts; missed drill is a tracked defect.
- **Tests:** scripted restore test in staging; integrity queries post-restore.
- **Manual QA:** time an actual restore.
- **DoD:** recovery is proven, not assumed.

## T-OPS-004 — Go-live and pilot rollout

- **Requirements:** NFR-OPS-004
- **Goal:** Pilot go-live checklist, operator training, support process, cost tracking.
- **ADR:** ADR-0024
- **Product Docs:** `OPERATIONS.md`, `ROADMAP.md` §2, `QA.md`
- **Modules:** ops + docs
- **Dependencies:** T-OPS-003, T-OBS-002, T-SEC-002
- **Behavior:** staged rollout (1 area, 5–20 stalls), daily support stand-up, defect triage, cost per stall tracked.
- **Invariants:** acceptance criteria AC-01…AC-12 measured, not asserted.
- **Finance:** cost discipline (NFR-OPS-006). **Security:** production access list + audit.
- **Privacy:** DPIA completed for loyalty/pilot features before enabling them.
- **Offline:** pilot explicitly tests offline recovery in the field.
- **Concurrency:** n/a. **Failures:** abort criteria defined (e.g. money-integrity defect) with rollback plan.
- **Tests:** pilot acceptance run of `QA.md` field scenarios.
- **Manual QA:** the pilot itself, with operator observation sessions.
- **DoD:** operators use it daily without HQ hand-holding, and HQ trusts the numbers.

---

## Task summary

| Slice | Tasks |
| --- | --- |
| VS-0 | T-FOUND-001..006 (6) |
| VS-1 | T-OP-001..002, T-STALL-001..002, T-AUTHZ-001 (5) |
| VS-2 | T-LOC-001..003 (3) |
| VS-3 | T-SHIFT-001..002, T-LOC-004..005, T-OFF-001, T-HQ-001 (6) |
| VS-4 | T-MENU-001..002, T-PRICE-001..004 (6) |
| VS-5 | T-SALE-001..004 (4) |
| VS-6 | T-PAY-001..004 (4) |
| VS-7 | T-EXP-001..004 (4) |
| VS-8 | T-STOCK-001..004 (4) |
| VS-9 | T-CLOSE-001..004 (4) |
| VS-10 | T-HQ-002..003 (2) |
| VS-11 | T-LOY-001..003 (3) |
| VS-12 | T-COMM-001, T-ALERT-001 (2) |
| VS-13 | T-INC-001..002 (2) |
| VS-14 | T-PERF-001..002 (2) |
| VS-15 | T-REC-001..002 (2) |
| VS-16 | T-OFF-002..004 (3) |
| VS-17 | T-SEC-001..002, T-OPS-001 (3) |
| VS-18 | T-OBS-001..002 (2) |
| VS-19 | T-OPS-002..004 (3) |
| **Total** | **70 tasks** |

**First future implementation task: T-SHIFT-001 (VS-3) — Start Shift.**
Implementation is **NOT PART OF THE CURRENT PHASE**.
