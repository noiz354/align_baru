# MVP Task Breakdown — Gap Analysis vs Yomi's Existing Spec

Date: 2026-09-27 · Status: **proposal, not merged.** Nothing here is an authorized task until
TASKS.md is amended through the spec process (AGENTS.md §4.5, §6).

## 0. Why this is a proposal and not an edit to TASKS.md

TASKS.md holds 134 task entries across 12 slices and is authoritative. The MVP brief this
responds to overlaps most of it. Appending a parallel task list would create a second source
of truth, which is exactly what AGENTS.md §6 forbids. So this document does three things:

1. States what the MVP brief asks for that **Yomi already specifies**, with the task IDs.
2. Isolates the **genuine gaps** — 20 of them, listed in §2.
3. Writes those gaps as task entries in Yomi's own field format, with slice placement,
   requirement mapping, and skill routing.

Adopting it means amending PRD.md (new FR-* rows), DATA_MODEL.md (new columns/tables),
TASKS.md (new entries), ROADMAP.md (new slice), and API_CONTRACT.md (event payload contract).
That amendment is a spec task in its own right and is not in scope here.

## 1. Already covered — do not re-task

The MVP brief's UI, backend, image-pipeline, progress, publish-state, search and cache
sections map onto existing Yomi work. Verified by term search across TASKS.md / DATA_MODEL.md.

| MVP brief asks for | Yomi already has |
|---|---|
| Reader: 3 modes, LTR/RTL, keyboard map, tap zones, swipe cancel, fullscreen, zoom, page counter, progress, auto-hide chrome, image retry, end-of-chapter + next chapter | `T-READER-001…103` — the most detailed family in the spec (33 entries) |
| Preload `current ± N`, bounded window, eviction | `T-READER-019/020/031` |
| Page preload indicator | `T-READER-020` |
| Image pipeline: upload → validate → decode → normalize → variants → object storage, dimensions, MIME validation, corrupt rejection, immutable asset URL | `T-UPLOAD-001…018` + `T-MEDIA` ports + ADR-005 |
| Content hash, duplicate detection, max pixel count, retryable processing | `T-UPLOAD-*` (verify per task before assuming) |
| Cache-control / immutable caching, format ladder | `T-PERF-001/002` |
| Progress: userId/mangaId/chapterId/page + percentage, idempotent, debounced not per-pixel | `T-READER-023/024/025`, `progress` repositories |
| Chapter states DRAFT / PROCESSING / READY / PUBLISHED / ARCHIVED, never visible before processing completes | `T-UPLOAD-*`, `T-ADMIN-*` — 67 publish-state references |
| Search: normalized title, alt title, author, genre, tag, status; sort; PostgreSQL only, no Elasticsearch | `T-SEARCH-001…006` |
| Cache only what is useful (detail, chapter metadata, latest, popular), no Redis | `T-PERF-002`; Redis is explicitly out per SKILLS.md §6 |
| Auth, history, bookmarks, reader preferences, library read-status | `T-AUTH-001…013`, `T-LIB-001…009` |
| Admin manga/chapter CRUD, upload status, failed processing, bulk publish | `T-ADMIN-001…008`, `T-UPLOAD-*` |
| Offline / reconnect indicator | `T-READER-020` |
| Technical observability: latency, error rates, JS errors, memory | `T-OBS-001…007`, `T-PERF-005/007` |

## 2. Genuine gaps — 20

Verified absent by term search. These are the only items the MVP brief adds.

| # | Gap | Evidence of absence |
|---|---|---|
| 1 | **Follow a series** (the MVP's "Following" shelf and follow-conversion metric) | `TASKS.md`+`DATA_MODEL.md`: 0 matches for follow; the single "follow" hit is "follow-up" in an upload note. Bookmarks exist (21 refs) but are a different feature. |
| 2 | **Library status enum** (Reading / On hold / Completed / Dropped) | 0 matches. The 3 "dropped" hits are progress-merge `{applied, dropped}` and OTel "spans dropped". Library has bookmark + read-status only. |
| 3 | **UI loading + skeleton states** (catalog, detail, reader, admin) | 0 matches for a loading state. All 33 "skeleton" matches refer to the skeleton-code phase, not a loading UI. |
| 4 | **Product analytics events** (`manga_viewed`, `chapter_opened`, `chapter_completed`, `reader_mode_changed`, `search_performed`, `manga_followed`, …) | 0 matches. `T-OBS-007` is a *beacon/telemetry transport*, not an event taxonomy. |
| 5 | **Progress checkpoints 25/50/75/100** | 0 matches. The "25%" hit is the swipe commit threshold. |
| 6 | **Reader funnel** (detail → open → 25 → 50 → 75 → completed → next) | 0 matches for funnel or drop-off. |
| 7 | **Search analytics** (`query`, `resultCount`, `clickedMangaId`, zero-result logging) | 0 matches. `T-SEARCH-*` covers serving search, not measuring it. |
| 8 | **Content analytics** (top manga/chapters, completion rate, unique readers, trending, new vs returning, genre mix) | 0 matches. `T-OBS-006` dashboards are technical, not content. |
| 9 | **Reader performance as emitted metrics** (`first_page_visible_ms`, `next_page_visible_ms`, `image_failure_rate`, `chapter_asset_bytes`, `reader_memory_estimate`) | 0 matches. `T-PERF-007` profiles memory as a gate; nothing is emitted. |
| 10 | **Admin analytics dashboard** (Today / Content / Operations) | `T-OBS-006` is infra dashboards. No content view. |
| 11 | **Fit width / fit height** | 0 matches in TASKS/DATA/PRD. |
| 12 | **Reader background theme** (light/sepia/dark) | 0 matches. |
| 13 | **Admin page ordering** (drag/drop reorder) | 0 real matches; all `reorder`/`drag` hits are reader scroll, swipe and zoom pan. |
| 14 | **Admin preview before publish** | 0 real matches; hits are "catalog preview" and an error-page link. |
| 15 | **Missing-page detection** at commit time | 1 weak hit; not a specified guard. |
| 16 | **Analytics privacy + retention** | Absent as a task; NFR-SEC-* covers secrets, not event PII. |
| 17–20 | Follow conversion hook, continue-reading click event, bulk *page* upload distinct from bulk publish, search sort by popularity | Partially covered (`T-SEARCH-003` ranking, `T-ADMIN-*` bulk publish) — need per-task confirmation, listed here so they are not lost. |

## 3. New slice VS-12 — Product & Content Analytics

Sequenced after VS-11 in `ROADMAP.md` order. Depends on VS-0 (schema, CI), VS-2 (reader
state), VS-5 (auth identity for user-scoped events) and VS-10 (telemetry transport).

### T-ANL-001 — Analytics event taxonomy & payload contract
- **Requirements:** new `FR-ANL-001…006`; NFR-OBS-001
- **Goal:** One authoritative table of product events: event name, when it fires, required
  properties, whether it is user-scoped or anonymous, and its PII classification. Written
  before any emitter, so client and server cannot drift.
- **Depends on:** T-FOUND-009 (error contract pattern), T-OBS-007 (transport)
- **Expected modules:** shared/contracts
- **Inputs:** the event list in §5 of the brief; `/api/reader/beacon` shape
- **Expected behavior:** 1. Every event has a typed, versioned payload. 2. Unknown event
  names are rejected at compile time (exhaustive switch, mirroring `AppError`). 3. A CI check
  proves every emitter references a declared event.
- **Edge cases:** client/server clock skew; duplicate delivery; a property that is PII in one
  event and not in another.
- **Security:** the taxonomy carries an explicit PII flag per event; no page content, title,
  or query text may be classified non-PII by default.
- **Testing:** UNIT-ANL-001 (every event has a payload; PII flag present).
- **Manual QA:** —
- **DoD:** AGENTS.md
- **Skills:** `typescript-advanced-types`, `backend-structured-logging`, `api-and-interface-design`

### T-ANL-002 — Event ingestion endpoint & validation
- **Requirements:** FR-ANL-002; NFR-SEC-010
- **Goal:** `POST /api/analytics/events` (batch, ≤ 50 events) accepting the typed payloads,
  with junk rejection (unknown event, wrong types, oversized), sampling for high-volume
  events, and no PII persisted.
- **Depends on:** T-ANL-001
- **Expected modules:** server/telemetry, src/app/api
- **Expected behavior:** 1. 202 on accept, 422 on schema violation (whole batch rejected,
  never partial). 2. Anonymous events accepted; user-scoped events require a session.
  3. Duplicate event ids are idempotent.
- **Edge cases:** clock skew, replayed batches, batch containing one bad event.
- **Security:** no stack traces or payload echo in errors; rate limited per session
  (`T-SEARCH-005` pattern).
- **Testing:** UNIT-ANL-002 (validation table), INT (batch accept/reject, idempotency).
- **Manual QA:** curl a valid and an invalid batch.
- **DoD:** AGENTS.md
- **Skills:** `backend-idempotency`, `security-and-hardening`, `backend-structured-logging`

### T-ANL-003 — Server-side emitters (catalog, auth, library, search)
- **Requirements:** FR-ANL-003
- **Goal:** Emit `manga_viewed`, `chapter_opened`, `chapter_completed`, `search_performed`,
  `search_result_opened`, `manga_followed`, `manga_unfollowed`, `continue_reading_clicked`
  from the services that already own those transitions. No new call sites in UI code.
- **Depends on:** T-ANL-002, VS-1, VS-5, VS-8
- **Expected modules:** features/{catalog,chapters,library,search,progress}
- **Expected behavior:** 1. Emitted from the service layer, not the route handler, so a
  second caller cannot double-count. 2. `chapter_completed` is sticky and fires once.
- **Edge cases:** completion on the last page vs the "mark as read" path (one event, not two);
  anonymous viewing must not create a user row.
- **Security:** user id is a server-derived hash, never a client-supplied id.
- **Testing:** INT-ANL-001 (one event per transition, counted from the DB).
- **Manual QA:** read a chapter end-to-end, confirm the event rows.
- **DoD:** AGENTS.md
- **Skills:** `backend-structured-logging`, `backend-idempotency`, `observability-and-instrumentation`

### T-ANL-004 — Client reader emitters & 25/50/75/100 checkpoints
- **Requirements:** FR-ANL-004; reader-behavior.md §12
- **Goal:** Emit `reader_mode_changed`, `reader_page_changed`, the four completion
  checkpoints, and `next_chapter_opened` from the reader, batched through the beacon and
  cancelled by any input like the auto-advance timer.
- **Depends on:** T-ANL-002, T-READER-003
- **Expected modules:** features/reader
- **Expected behavior:** 1. Never one event per scroll pixel — checkpoints and page
  boundaries only. 2. A checkpoint fires at most once per chapter per session.
  3. Flush on `visibilitychange` and `beforeunload`.
- **Edge cases:** a 3-page chapter cannot reach 75% cleanly; checkpoints must be
  page-referenced, not percentage-computed, to stay monotonic.
- **Security:** no pixel coordinates, no scroll depth beyond the page index.
- **Testing:** UNIT-ANL-003 (checkpoint monotonicity, once-per-session), INT (batching).
- **Manual QA:** read a 30-page chapter, confirm exactly 4 checkpoint rows.
- **DoD:** AGENTS.md
- **Skills:** `typescript-advanced-types`, `backend-idempotency`, `test-driven-development`

### T-ANL-005 — Reader funnel query
- **Requirements:** FR-ANL-005
- **Goal:** One query per manga/chapter returning the funnel: detail views → chapter opens →
  25/50/75/completed → next chapter, as counts and as conversion rates.
- **Depends on:** T-ANL-003, T-ANL-004
- **Expected modules:** server/db, features/admin
- **Expected behavior:** 1. One round trip (NFR-PERF-014 — an index or a materialized view
  ships with this task). 2. Rates are computed from the same snapshot so numerator and
  denominator are consistent.
- **Edge cases:** a chapter re-ingested shorter than the last checkpoint; events older than
  the retention window (T-ANL-012).
- **Security:** counts only; no per-user rows in the aggregate view.
- **Testing:** INT-ANL-002 (known fixture → exact counts), plus an EXPLAIN check.
- **Manual QA:** seed a chapter, read it, compare the dashboard to the events table.
- **DoD:** AGENTS.md
- **Skills:** `supabase-postgres-best-practices`, `postgresql-optimization`, `typescript-advanced-types`

### T-ANL-006 — Drop-off analysis per chapter
- **Requirements:** FR-ANL-006
- **Goal:** For each chapter, the last checkpoint reached and the percentage of readers who
  never advanced to the next chapter — the signal for "this chapter is too heavy".
- **Depends on:** T-ANL-005
- **Expected modules:** features/admin
- **Expected behavior:** 1. Ranks chapters by drop-off. 2. Separates "dropped mid-chapter"
   from "finished and stopped" (different problems).
- **Edge cases:** a final chapter has no next, so its drop-off is not a failure.
- **Security:** —
- **Testing:** INT-ANL-003 (fixture with a known funnel shape).
- **Manual QA:** —
- **DoD:** AGENTS.md
- **Skills:** `supabase-postgres-best-practices`, `frontend-ui-engineering`

### T-ANL-007 — Search analytics & zero-result capture
- **Requirements:** FR-ANL-007
- **Goal:** Record `query`, `resultCount`, `clickedMangaId`, and log zero-result searches
  separately so typo and missing-alternative-title candidates are visible.
- **Depends on:** T-ANL-003, T-SEARCH-001
- **Expected modules:** features/search
- **Expected behavior:** 1. A search with no click is still recorded. 2. Raw query text is
  PII-classified and access-controlled (T-ANL-012). 3. The existing rate limit still applies.
- **Edge cases:** the same query repeated by one user; a query that is a slug.
- **Security:** raw query text is never logged to stdout (`T-OBS-003` redaction).
- **Testing:** UNIT-ANL-004, INT-ANL-004 (zero-result path).
- **Manual QA:** search a nonsense string, confirm it appears in the admin list.
- **DoD:** AGENTS.md
- **Skills:** `backend-structured-logging`, `security-and-hardening`, `supabase-postgres-best-practices`

### T-ANL-008 — Content analytics rollups
- **Requirements:** FR-ANL-008
- **Goal:** Top manga, top chapters, completion rate, unique readers, trending, new vs
  returning reader split, and genre mix, over a selectable window.
- **Depends on:** T-ANL-005
- **Expected modules:** features/admin, server/db
- **Expected behavior:** 1. "Trending" is defined as a stated formula, not an intuition.
  2. Unique readers are counted per window with a stated identity rule.
- **Edge cases:** a window shorter than the retention window; bots excluded by the same
  identity rule.
- **Security:** aggregate only.
- **Testing:** INT-ANL-005 (fixture counts per genre, new vs returning).
- **Manual QA:** —
- **DoD:** AGENTS.md
- **Skills:** `supabase-postgres-best-practices`, `postgresql-optimization`, `frontend-ui-engineering`

### T-ANL-009 — Reader performance metrics as emitted signals
- **Requirements:** FR-ANL-009; NFR-OBS-007
- **Goal:** Emit `chapter_first_page_visible_ms`, `next_page_visible_ms`,
  `image_failure_rate`, `chapter_asset_bytes`, `reader_memory_estimate` per chapter, so the
  500-page case is measurable in production and not only in the lab harness.
- **Depends on:** T-ANL-002, T-READER-031, T-PERF-007
- **Expected modules:** features/reader, server/telemetry
- **Expected behavior:** 1. First-page-visible is measured from navigation start to paint.
  2. Asset bytes are the sum for the chapter, not per page. 3. Memory estimate is coarse
  (a bucket), never a heap dump.
- **Edge cases:** a page served from cache makes the timing meaningless — mark the sample.
- **Security:** no device fingerprinting in these payloads.
- **Testing:** INT-ANL-006 (metric present for a seeded chapter).
- **Manual QA:** —
- **DoD:** AGENTS.md
- **Skills:** `observability-and-instrumentation`, `performance-optimization`, `backend-structured-logging`

### T-ANL-010 — Admin analytics dashboard
- **Requirements:** FR-ANL-010
- **Goal:** `/admin/analytics` with three blocks: Today (active readers, chapter opens,
  completions, follows, searches), Content (top manga, top chapters, low-completion
  chapters), Operations (failed uploads, failed image jobs, missing pages, unpublished
  drafts).
- **Depends on:** T-ANL-005, T-ANL-006, T-ANL-008
- **Expected modules:** src/app/admin, features/admin
- **Expected behavior:** 1. Operations block reuses the existing failure data — no second
  source of truth. 2. Admin-only (T-SEC-003 matrix). 3. Every number links to the rows
  behind it.
- **Edge cases:** empty state for a new install (a dashboard of zeros must still be
  navigable, per T-SEARCH-006).
- **Security:** admin authorization; the Operations block must not expose storage keys.
- **Testing:** E2E-ANL-001 (admin sees it, a non-admin gets the standard 403), plus axe.
- **Manual QA:** click through at desktop and mobile widths, both themes.
- **DoD:** AGENTS.md
- **Skills:** `frontend-ui-engineering`, `accessibility`, `web-quality-audit`

### T-ANL-011 — Analytics privacy, retention & access control
- **Requirements:** new `NFR-ANL-001…004`
- **Goal:** Retention window and hard delete for event rows, DSAR export/delete, PII
  redaction enforcement, and role-based access to raw query text.
- **Depends on:** T-ANL-002
- **Expected modules:** server/db, src/server/auth
- **Expected behavior:** 1. Events older than the window are deleted by a scheduled job.
  2. Deleting a user deletes their user-scoped events. 3. Raw search text is visible only to
  a named role.
- **Edge cases:** a user deleted mid-window; a legal hold request (documented as a manual
  exception, not automated).
- **Security:** this task is the security task for the whole slice.
- **Testing:** INT-ANL-007 (retention job, DSAR delete, role gate).
- **Manual QA:** —
- **DoD:** AGENTS.md
- **Skills:** `security-and-hardening`, `best-practices`, `supabase-postgres-best-practices`

## 4. Additions to existing families

| New task | Slice | Goal | Depends on | Skills |
|---|---|---|---|---|
| **T-LIB-010** — Library status enum | VS-5 | `status ∈ {reading, on_hold, completed, dropped}` on the library entry, with transitions and a read-status reconciliation rule (auto-set `completed` on chapter completion, never auto-unset a manual status) | T-LIB-002 | `typescript-advanced-types`, `supabase-postgres-best-practices`, `accessibility` |
| **T-LIB-011** — Follow / unfollow a series | VS-5 | Follow as a distinct relation from bookmark, with a follow-count column and a follow-conversion event hook into T-ANL-003 | T-LIB-002 | `typescript-advanced-types`, `backend-idempotency`, `accessibility` |
| **T-READER-034** — Fit width / fit height | VS-3 | A fit mode alongside the existing zoom model: `fit: 'width' \| 'height' \| 'none'`, persisted in `ReaderPreference`, restoring to explicit zoom when unset | T-READER-020 | `typescript-advanced-types`, `test-driven-development`, `accessibility` |
| **T-READER-035** — Reader background theme | VS-2 | Reader backdrop token set (light / sepia / dark / custom) applied behind the page box, letterbox included, with the theme stored in `ReaderPreference` and both themes meeting contrast | T-FOUND-004, T-READER-011 | `accessibility`, `frontend-ui-engineering`, `test-driven-development` |
| **T-ADMIN-009** — Chapter page ordering | VS-6 | Reorder pages within a chapter, drag-and-drop plus a keyboard-accessible move control (drag is never the only path), atomic commit, and an `order` column with a uniqueness constraint | T-ADMIN-004 | `frontend-ui-engineering`, `accessibility`, `backend-idempotency` |
| **T-ADMIN-010** — Preview before publish | VS-6 | Render a DRAFT chapter in the real reader under an explicit preview mode that is not indexed, not in the catalog, and cannot be reached by a public route guess | T-ADMIN-004, T-READER-002 | `security-and-hardening`, `frontend-ui-engineering`, `accessibility` |
| **T-ADMIN-011** — Missing-page detection at commit | VS-7 | Refuse to move a chapter to READY when the committed page count contradicts the uploaded manifest; name the gaps in the admin UI | T-UPLOAD-012 | `typescript-advanced-types`, `backend-idempotency`, `frontend-ui-engineering` |
| **T-CATALOG-011** — Loading, skeleton and empty states | VS-1 | A declared loading/skeleton/empty/error state for catalog, detail, chapter list and reader, including the offline and reconnect indicator, each axe-clean and each announced to assistive tech | T-CATALOG-003 | `frontend-ui-engineering`, `accessibility`, `web-quality-audit` |

## 5. What this deliberately does not add

The brief's own exclusions are respected and are already non-objectives or absent from Yomi:
comments, ratings, recommendation AI, forums, social profiles, notifications,
Elasticsearch, microservices, Redis, recommendation engines, achievements, gamification.

One tension worth flagging as a **spec-question**, not a decision: the brief asks for
"trending manga" and "most-read genres" (T-ANL-008). Those are reporting, not
recommendation, so they do not collide with the no-recommendation non-objective — but the
PRD should say so explicitly, otherwise a later reader may read a trending shelf as the
first step toward a recommendation engine and reject it.

## 6. Adoption checklist

1. PRD.md: add `FR-ANL-001…010` + `NFR-ANL-001…004`; state the trending non-objective note.
2. DATA_MODEL.md: analytics event table, library `status`, follow relation, page `order`.
3. API_CONTRACT.md: `POST /api/analytics/events` request/response, §6 error rows.
4. TASKS.md: append the 12 `T-ANL-*` entries and the 8 additions in §4.
5. ROADMAP.md: add VS-12 after VS-11, and amend the VS-1/2/3/5/6/7 slice task lists.
6. Regenerate `docs/TRACEABILITY.md` (it is generated — see the project's own script).
7. Re-run the doc verifier and the skill-name existence check from `SKILLS.md` §7.

## 7. Skill routing for this slice

Per `SKILLS.md` (skills are advisory; the spec wins):

- **Always:** `test-driven-development`, `verification-before-completion`
- **New slice VS-12:** `typescript-advanced-types`, `backend-structured-logging`,
  `observability-and-instrumentation`, `supabase-postgres-best-practices`,
  `backend-idempotency`, `security-and-hardening`, `postgresql-optimization`,
  `accessibility`, `web-quality-audit`
- **UI-bearing additions:** `frontend-ui-engineering`, `accessibility`, `web-quality-audit`
- **Not applicable here:** Go, Python, LLM/eval, prompt-engineering, MCP, Redis,
  event-bus skills — see `SKILLS.md` §6 for the per-group reason.
