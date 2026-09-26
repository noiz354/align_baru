# User Journeys

Detailed walk-throughs of the six canonical journeys (PRD §8). Each journey: actor, preconditions, step-by-step, expected states, failure branches, and the tasks that must be green for the journey to hold (E2E coverage).

## J-1 — First-time anonymous reader (P2, P3)

**Preconditions:** published catalog with seeded/uploaded content.
1. Land on `/` (home = catalog preview for anonymous users) → LCP is the first cover card (NFR-PERF-001).
2. Browse the catalog: scroll, filter by genre (chips), sort (most recently updated). Cards show cover, title, status, latest chapter (FR-CATALOG-005).
3. Open a manga (detail page): all fields visible (FR-CATALOG-006); "Read" primary action (no progress yet → chapter 1).
4. Open the chapter: first page paints pre-hydration (SSR shell, ADR-007); reader mounts; default mode vertical, direction RTL (manga default).
5. Read: scroll (vertical), position indicator updates ("Page 12 of 240"), progress bar fills.
6. Close the tab. **No account created, no data stored server-side** (anonymous; nothing local is promised — next visit starts fresh, documented).

**Failure branches:**
- Empty catalog → home shows the empty state ("The collection is being prepared — check back soon" + no broken grid).
- Chapter open with a failed first image → placeholder + retry (FR-READER-018); the chapter is still browsable.

**Tasks:** T-CATALOG-001…010, T-READER-001…004/014/029/031/032/033. **E2E:** E2E-CATALOG-001, E2E-READER-001.

## J-2 — Returning member (P4)

**Preconditions:** registered account with library entries and progress.
1. Land on `/` → "Continue reading" section (≤ 20, most recent first, FR-LIBRARY-005) with covers + "Ch. 12 · p. 45" context.
2. Tap an entry → reader opens at the **saved position** (page + scroll offset, FR-READER-012) — restored before images paint (no flicker to page 1).
3. Read on; progress syncs (server, FR-READER-014).
4. Reach the last page → completion card → auto-advance to Chapter 13 (preference on) after 1.5 s (cancelable).
5. Later: `/library` shows updated last-read + unread counts; `/history` shows the sessions; a bookmark from last week jumps to its page (T-LIB-008).

**Failure branches:**
- Saved chapter was deleted by the admin → entry shows "unavailable", clicking gives a labeled state (not a 404 wall); resume skips to the previous valid position (T-CATALOG-009 rules).
- Saved page beyond a re-ingested (shorter) chapter → clamp to last page + one notice (EC-RDR-10).

**Tasks:** T-AUTH-001…013, T-LIB-001…009, T-READER-014/015/016/021…025/029/033, T-CATALOG-009. **E2E:** E2E-LIB-001.

## J-3 — Slow connection (P2 on mobile data)

**Preconditions:** 3G-equivalent network (lab throttle or real network).
1. Open a 200-page chapter: first page ≤ 10 s (NFR-PERF-015); no full-page spinner > 10 s (progressive appearance — the page list is small JSON, images stream).
2. Scroll: pages appear progressively within the window (±3); the active page is always the high-priority request (T-READER-020 ladder); in-flight stays ≤ window + 2.
3. A page fails → placeholder + auto-retry once → succeeds (or manual Retry, FR-READER-018); the rest of the chapter never blocks on it.
4. Background the tab for 60 s → return: no request storm (pause-on-hidden rule); reading resumes at the exact position (local store held it).
5. Data usage: ~300 KB/page typical (AVIF, NFR-PERF-009) — a 200-page read ≈ 60 MB (recorded in the T-PERF-006 report).

**Failure branches:** network drops entirely → offline banner; already-loaded pages stay readable; position tracking continues locally; reconnect → pending syncs flush (FR-READER-014).

**Tasks:** T-READER-019/020/026, T-PERF-006, T-UPLOAD-004/005 (format ladder). **E2E:** E2E-READER-007 (throttled legs), T-PERF-006 report.

## J-4 — Curator onboarding (P1)

**Preconditions:** admin account (bootstrap, admin-workflow §2), empty or partial catalog.
1. `/admin` → empty-state onboarding ("No manga yet — create your first title").
2. Create manga: title, synopsis, genres, creator, direction (RTL), status ongoing → 201 (slug auto). Audit row appears (visible in `/admin/audit`).
3. Create chapter 1 (number 1).
4. Upload: choose a 30-page ZIP (or 30 images) → submit → job appears: `queued → validating → processing → ready` (watched live, 3 s poll; ~30–60 s for 30 pages).
5. Job ready → "View chapter" (draft preview renders — admin sees drafts, FR-CHAPTER-002) → "Publish" chapter (≥ 1 page requirement met) → publish manga.
6. **Verify:** open the chapter as a normal reader (incognito or logged-out context): it reads. (The verify step is deliberate: the loop closes on the *reader*, not on a green job.)

**Failure branches:**
- ZIP with 1 corrupt page → job `failed` with "Some images could not be read" + the page list (typed `UPLOAD_IMAGE_DECODE`) → curator fixes → re-upload (same chapter; no re-ingest needed since no prior pages).
- ZIP exceeds 500 MB → 413 with the limit stated (NFR-SEC-007) → curator splits.

**Tasks:** T-ADMIN-001…008, T-UPLOAD-001…011/013…015. **E2E:** E2E-ADMIN-001 (full loop).

## J-5 — Curator failure handling (P1)

**Preconditions:** a chapter already published with pages.
1. Curator receives a corrected scan of the same chapter → opens the chapter → "Re-ingest pages".
2. Upload 40-page corrected ZIP → job runs (re-ingest path; chapter locked to one active job — a concurrent attempt gets 409 job-busy).
3. Commit: new asset set live; old set GC-queued (24 h grace).
4. **In-flight reader** (a member mid-chapter): their active page's old key 404s after commit → reader refreshes the page list once → continues on the new keys (EC-UP-05); if their saved page now exceeds the new count, it clamps on next open (EC-RDR-10).
5. Stats + audit show the re-ingest; the member's library/history are unaffected (chapter identity unchanged).

**Failure branches:** re-ingest fails (corrupt corrected file) → chapter **keeps its old pages** (replace-or-fail rule, T-UPLOAD-009) → curator sees the typed failure → fixes → retries.

**Tasks:** T-UPLOAD-009, T-READER-028 (mid-session refresh), T-ADMIN-008. **E2E:** E2E-ADMIN-002 legs + reader-mid-reingest scenario.

## J-6 — Power reader (P3, desktop)

**Preconditions:** authenticated, preferences set (double, LTR for a Western comic), large chapter (500 pages).
1. Open the chapter → double-page LTR, 100% zoom. Keyboard-only from here: `Space` next spread, `←/→` back/forward (direction-aware), `End` to the end, `0` zoom reset, `F` fullscreen.
2. Skim to p. 300 (`End` then `←` × N, or `?page=300` deep link — saved position wins per §12 if it exists).
3. Zoom in on a detail: `+` to 200%, pan, `0` back.
4. Mode switch: `M` → vertical (same logical page, no CLS, zoom preserved) → back to double (zoom resets to 100% — the documented rule).
5. Direction: this is LTR; the reader's tap zones match (left = prev). (RTL titles use the mirrored map — J-1 covers RTL.)
6. Finish: completion at spread (250,249… final odd page single) → card → next chapter (auto-advance off for this user — manual `Space` on the card).
7. Memory/feel: no jank at p. 100→400 (residency ≤ 12, NFR-PERF-010); INP ≤ 200 ms (NFR-PERF-002); 30-min session heap growth ≤ 150 MB (M-6).

**Failure branches:** none expected in this journey — it's the *defined* power-user case; any failure here is a P0 defect (it's the E2E-READER-007 marathon).

**Tasks:** T-READER-005…013/016/019/020/026/027/030/031, T-PERF-005/007. **E2E:** E2E-READER-003/004/005/007.

## Journey → Verification Map

| Journey | Primary E2E | Manual pass (slice exit) |
|---|---|---|
| J-1 | E2E-CATALOG-001, E2E-READER-001 | VS-1 + VS-2 (desktop + phone) |
| J-2 | E2E-LIB-001 | VS-5 (phone) |
| J-3 | E2E-READER-007 throttled legs, T-PERF-006 | VS-4 (real phone on throttled data) |
| J-4 | E2E-ADMIN-001 | VS-6 (dry) + VS-7 (full, with real upload) |
| J-5 | E2E-ADMIN-002 + reingest scenario | VS-7 |
| J-6 | E2E-READER-003/004/005/007 | VS-3 + VS-4 (keyboard-only, SR spot) |
