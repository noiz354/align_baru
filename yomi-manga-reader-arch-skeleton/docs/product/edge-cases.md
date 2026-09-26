# Edge Case Register

Normative edge cases with their resolution rules. Each case: what happens, the rule (and where it's enforced), the task that implements/verifies it, and the test. "Owner" = the task responsible for making the behavior real and tested.

## Reader (EC-RDR-*)

| ID | Case | Rule (normative) | Owner | Test |
|---|---|---|---|---|
| EC-RDR-01 | Single-page chapter | Mode forced to single (double unavailable); completion on viewing the page ≥ 1 s; next-chapter flow normal | T-READER-003/005/016 | UNIT-READER-001 (1-page transitions), E2E-READER-002 |
| EC-RDR-02 | Chapter with 0 pages (draft/failed) | Reader route → "unavailable" state (409 mapping CHAPTER_NOT_READY): labeled cause + back link; no reader shell | T-READER-001/028 | INT-CHAP-001, E2E-READER-008 leg |
| EC-RDR-03 | Odd-page chapter in double mode | Final spread renders as a single centered page (pairing fallback) | T-READER-006 | UNIT-READER-006/007 |
| EC-RDR-04 | Rapid navigation (fast Space spam) | Transition queue depth 1; window recompute O(1); in-flight out-of-window requests cancelled; no fetch storm | T-READER-003/020 | UNIT-READER-005 (fuzz walks), E2E-READER-007 |
| EC-RDR-05 | Deep link `?page` invalid (0, −3, 999, "abc", "12.7", "١٢", empty) | Validate + clamp (never negative/out-of-range, FR-READER-023); one inline notice when clamped; API path returns 422 READER_INVALID_PAGE instead | T-READER-032/029 | UNIT-READER-002 (full input table + fuzz), E2E-READER-008 |
| EC-RDR-06 | Deep link vs saved position conflict | Saved position wins (user intent); deep link is the fallback when no save exists; bookmark jumps are the documented exception (explicit jump ⇒ deep link wins) | T-READER-029 | E2E (conflict scenario), UNIT-PROG-003 sibling |
| EC-RDR-07 | Two browser tabs, same chapter, same user | Independent local state per tab; server LWW (NFR-DATA-003) resolves contention; no cross-tab sync in v1 (documented limitation); no corruption possible | T-READER-021/024 | INT-PROG-001 (interleaved writes) |
| EC-RDR-08 | Chapter/manga deleted mid-session | Next interaction (page fetch/progress write) → 404 → reader "unavailable" state: labeled + back to catalog; local progress retained (harmless) | T-READER-028/029 | E2E (dev deletes mid-read), INT |
| EC-RDR-09 | Tab restore via bfcache | `pageshow` revalidates (chapter still exists? progress fresh?); silent if unchanged | T-READER-029 | E2E-READER-001 leg |
| EC-RDR-10 | Saved page > current pageCount (re-ingest shrank the chapter) | Clamp to last page on restore + one notice; progress row updated lazily (next write, idempotent) | T-READER-029/022 | UNIT (clamp rule), E2E-ADMIN reingest scenario |
| EC-RDR-11 | Anonymous reading on device A, sign in having read more on device B | Merge per chapter, latest-wins (client timestamps, then server-stamped): the member lands on the *newer* position (B's, if later); one confirmation; no data loss (older local entry is superseded, not deleted — it stays local, harmless) | T-READER-024 | UNIT-PROG-003, E2E (anon → sign-in) |
| EC-RDR-12 | Mode/direction switch at a boundary page | Position identity preserved (A→B→A = identity); clamped after recompute; zoom reset rule on double transitions only; zero CLS (reserved slots) | T-READER-030 | UNIT-READER-008 (property), E2E-READER-003 (CLS assert) |

## Upload (EC-UP-*)

| ID | Case | Rule | Owner | Test |
|---|---|---|---|---|
| EC-UP-01 | ZIP with mixed valid/corrupt images | Per-page decode failures collected; job fails if > 5% of pages fail **or** page 1 fails; error lists failed pages (capped at 20 listed) | T-UPLOAD-004 | INT-UP-001 (corrupt-page fixture) |
| EC-UP-02 | Archive containing directories only / no images | 0 images ⇒ `UPLOAD_NO_IMAGES` (422); job failed early (validating phase) | T-UPLOAD-014 | UNIT-UP-001 |
| EC-UP-03 | Duplicate chapter number on create | 409 CHAPTER_DUPLICATE_NUMBER; admin picks another number (no auto-increment — explicit is safer for scans) | T-ADMIN-004 | INT-ADMIN-001 |
| EC-UP-04 | Upload of a chapter for a deleted manga | Intake 404 MANGA_NOT_FOUND (checked at intake — early, before staging) | T-UPLOAD-001 | INT-UP-001 |
| EC-UP-05 | Re-ingest while readers are mid-chapter | Replace-or-fail; commit switches keys atomically; in-flight readers refresh the page list once on the active-key 404 (T-READER-028); old keys serve for 24 h grace (GC delay) so most in-flight sessions never 404 | T-UPLOAD-009, T-READER-028 | E2E (mid-reingest scenario) |
| EC-UP-06 | Network drop mid-multipart upload | Parts already uploaded are resumable (same part key, ETag check); abandoned part sets purge via 24 h lifecycle; job never created until completion is posted | T-UPLOAD-008 | INT-UP-002 |
| EC-UP-07 | Two jobs for the same chapter (race) | Advisory lock on chapter id: first wins, second gets 409 job-busy (retry later) | T-UPLOAD-006 | INT-UP-001 (concurrent) |
| EC-UP-08 | App restart mid-processing | Job stays `processing`; boot sweep (or watchdog) marks it `failed` with `ops.timeout` after 15 min; staging purges 24 h; curator re-uploads (no silent half-commit: the commit transaction rolled back with the crash) | T-UPLOAD-006, T-OBS-005 | INT (restart simulation), RUNBOOK 3.1 |
| EC-UP-09 | Non-UTF8 entry names / odd encodings | Reject `UPLOAD_BAD_ENTRY_NAME` (no guessing; curated content should be re-packaged) | T-UPLOAD-003 | UNIT-UP-002, fixture |
| EC-UP-10 | Encrypted ZIP | Detect (flag bit) → reject `UPLOAD_BAD_CONTAINER` with "password-protected archives are not supported" | T-UPLOAD-002 | UNIT-UP-001, fixture |

## Admin (EC-ADM-*)

| ID | Case | Rule | Owner | Test |
|---|---|---|---|---|
| EC-ADM-01 | Rename manga after publish | Allowed (title editable); **slug immutable** after first publish (deep links stable); rename is content-only | T-ADMIN-002 | INT-ADMIN-001 |
| EC-ADM-02 | Soft-delete manga with user progress | Catalog surfaces 404; user progress rows retained (harmless, private); library entry retained (private) reading 404; restore re-shows everything — no user data ever deleted by an admin action (privacy rule) | T-ADMIN-003 | INT-ADMIN-001 |
| EC-ADM-03 | Delete chapter with pages (admin confirm) | Soft-delete; pages GC-queued; progress/history orphan-preserved (history chapter → null, rendered "Unavailable chapter") | T-ADMIN-004 | INT (orphan preservation) |
| EC-ADM-04 | Last admin demotes/disables self | 409 ADMIN_LAST_ADMIN with explanation; the UI disables the control + explains (defense in depth: UI hint + API guard) | T-ADMIN-006 | UNIT (guard), INT |
| EC-ADM-05 | Admin disables an active reader | Reader's next request → 403 AUTH_DISABLED (session dead on contact); no waiting for expiry | T-AUTH-008 | INT (disabled-user matrix) |
| EC-ADM-06 | Audit before/after with huge synopsis | Summaries capped 2 KB/field (truncated, marked); full content never in audit (PII/size hygiene) | T-ADMIN-007 | INT-ADMIN-002 |
| EC-ADM-07 | Slug collision on create | Auto-slug uniqueness check; on conflict append -2/-3 (deterministic) or admin edits the slug pre-publish | T-ADMIN-002 | INT-ADMIN-001 |
| EC-ADM-08 | Publish a manga with 0-page chapters | Those chapters stay draft (bulk publish skips them, counts in `{ affected }`); the response tells the curator what was skipped | T-ADMIN-005 | INT-ADMIN-001 |

## Search (EC-SE-*)

| ID | Case | Rule | Owner | Test |
|---|---|---|---|---|
| EC-SE-01 | CJK / non-Latin titles (trigram weakness) | CJK titles additionally match by prefix (`LIKE 'q%'` path); trigram handles Latin; both paths ranked together (CJK prefix = prefix band) | T-SEARCH-002/001 | INT-SEARCH-001 (CJK fixture titles) |
| EC-SE-02 | Search on an empty catalog | Distinct empty-catalog state ("The catalog is empty — content is added by the curator"), not "no results" | T-SEARCH-006 | E2E-SEARCH-001 |
| EC-SE-03 | Query that matches a deleted manga | Deleted titles never match (visibility rule applies to search — the query filters `deleted_at IS NULL`) | T-SEARCH-001 | INT-SEARCH-001 |
| EC-SE-04 | 1–2 character queries | Trigram needs 3+ chars for similarity; 1–2 chars use the prefix path only (documented; results are prefix-only) | T-SEARCH-002 | UNIT-SEARCH-001 (band table) |

## Cross-cutting (EC-XX-*)

| ID | Case | Rule | Owner | Test |
|---|---|---|---|---|
| EC-XX-01 | Clock skew (progress timestamps, session expiry) | Server clock is authoritative for all stored timestamps (NFR-DATA-003/006); client timestamps are advisory (merge input only); session sliding uses server time | T-READER-021, T-AUTH-006 | UNIT-AUTH-003, INT-PROG-001 |
| EC-XX-02 | 60 s API cache after unpublish | Unpublish hides immediately for *new* requests to the app, but cached API responses (60 s SWR) may serve the old list to some readers for up to 60 s (documented tolerance, NFR-PERF-013); the *page* itself 404s at the media boundary (keys are checked per request? NO — media is immutable; unpublish hides via the page-list API, which is 60 s-cached — accepted, documented) | T-ADMIN-005, T-PERF-002 | INT (publish/unpublish timing) |
| EC-XX-03 | Storage outage during a read | Media 502 typed; reader placeholders + banner (T-READER-028/017); `/readyz` 503 (storage leg); catalog/detail still serve (DB-backed) | T-READER-028, T-OBS-004 | INT-OBS-001 (chaos), E2E-OBS-001 |
| EC-XX-04 | DB outage | APIs fail typed (5xx mapped, no partial renders of half-data — RSC error boundary shows the error state); `/readyz` 503; healthz 200 (process alive) | T-OBS-004, T-FOUND-009 | INT-OBS-001 (chaos) |
| EC-XX-05 | Browser without AVIF (pre-2024) | `<picture>` ladder falls back WebP → JPEG (FR-MEDIA-002); no runtime negotiation needed (format support is a client capability, declared by the ladder) | T-UPLOAD-005, T-CATALOG-010 | E2E (UA capability emulation) |
| EC-XX-06 | Very long URLs (query params, deep links) | Route params validated/length-capped (slug ≤ 190, page parsed to number|null); overlong ⇒ 404 (not 414 — 404 is the honest "doesn't exist") | T-FOUND-003, T-READER-001 | UNIT (param parsing) |
| EC-XX-07 | i18n | Out of scope (product is single-language, English UI; manga content is the user's). Strings are centralized (future i18n-ready) but no translation work is planned (NO- list) | — | — |
