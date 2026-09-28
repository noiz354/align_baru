# MVP Matrix — WAVE3 (2026-09-28, Asia/Jakarta)

> Branch: `arena/01a0e54f-align-baru` · Baseline `d5f0974` `mvp-wave3-baseline-d5f0974` → Wave3 `75b2b39` (homeops docs) + prior `138348c` (majelishub) `b09d207` (yomi) + `24dfc5e` `1a7a81a` `e244043`
> Wave3 objective: one important demo-only boundary becomes real per RUNNABLE_DEMO project; 4 MVP_PARTIAL + 1 MVP_READY frozen unless regression.

| Project | Wave2 | Wave3 | New Proven Boundary | Failure/Isolation | Blocker | Impl Commit |
|---|---|---|---|---|---|---|
| **parking-attendant-ops-app-spec** | `MVP_READY` (ed6938f) | **`MVP_READY`** (frozen) | — no new boundary (already MVP_READY; hardening optional, none applied this wave) | — | QRIS settlement hardening would be next but not required for Wave3 truthful matrix | `ed6938f` |
| **manga-reader-spec-skeleton-minimal** | `MVP_PARTIAL` (25fe21c) | **`MVP_PARTIAL`** (frozen) | — | — | Authz/upload still missing | `25fe21c` |
| **siomayops-streetfood-stall-ops-spec** | `MVP_PARTIAL` (01ef95f) | **`MVP_PARTIAL`** (frozen) | — | — | QRIS PENDING→PAID not settled | `01ef95f` |
| **strangerlink-random-chat-webrtc-spec** | `MVP_PARTIAL` (4046583) | **`MVP_PARTIAL`** (frozen) | — | — | TURN/moderation not E2E | `4046583` |
| **rsi-agent-recursive-self-improvement-prototype** | `MVP_PARTIAL` (33ea9ea) | **`MVP_PARTIAL`** (frozen) | — | — | External real key not exercised | `33ea9ea` |
| **yomi-manga-reader-arch-skeleton** | `RUNNABLE_DEMO` (797b2c8) | **`MVP_PARTIAL`** | Authenticated per-user `library_entry` PK (user_id,manga_id), `bookmark` unique (userId,chapterId,pageNumber), `reading_progress` PK (userId,chapterId) scoped by session `userId` not hard-coded. User A `reader.a` `594f4d49-2fb9-7e63-ca9a-7082a0b54f29` library 1 bookmark `555bae10-517f-4571-8ff6-f500fc4b4355` page2 progress 4 durable after `kill 2150→2557 Ready 485ms` vs User B `594f4d49-d9c9-78ea-2748-914ee067d1a3` library0 bookmark `16b0fbb6-78c6-4739-a776-2da52fb5b479` page3 progress 2 isolated, B cannot read A library/bookmark. | Unauth `POST /chapters/…/progress {5}` 401 `AUTH_REQUIRED`, malformed `9999`/`pageCount6` 422 `READER_INVALID_PAGE`, cross-user B `GET /library` 0 vs A1, B distinct bookmark vs A `555bae…` | Prod PG18+MinIO not S3, but per-user isolation now real | `e244043` |
| **majelishub-pengajian-event-platform-spec** | `RUNNABLE_DEMO` (59f4dd4) | **`MVP_PARTIAL`** | `event_registrations` `token_hash=sha256(token)`+`short_code` unique, `event_attendance` `unique(registration_id)` exactly-one. `POST /registrations` 201 `9a7e532…` `3TZ-KJ2` `registrationId 01a0e659-1506…` → `POST /checkin/validate` VALID `attendanceId 01a0e659-22cc…` → duplicate scan ALREADY_CHECKED_IN same id, summary `2/1` after duplicate+restart PID 3311→3472 Ready 486ms audit chain 1→4 `prev_hash` linked. | Duplicate registration `ALREADY_REGISTERED` 200, malformed token `short` 400 `INVALID_FORMAT`, unknown token `ff…` 404 `INVALID_TOKEN`, cross-tenant Jakarta token→Bandung `594f4d49-0923…` 409 `WRONG_EVENT`, unknown event 404, bad email 422 | Media/transcript not real | `1a7a81a` |
| **homeops-household-manager-spec** | `RUNNABLE_DEMO` (d92529e) | **`MVP_PARTIAL`** | `Buang sampah` DAILY `3b79c5cc…` `ca32a2a0…:2026-09-28` OPEN → Today 1 → complete → COMPLETED `2026-09-28T05:00:41.314Z` + next `cb793644…:2026-09-29` OPEN via `occurrenceKey=${definitionId}:${dueOn}` `onConflictDoNothing`. Double-complete `deduped:true` list stays 2, weekly `2026-09-28→2026-10-05` (+7), restart PID 4431→4564 Ready 439ms list still 2 rows Today 09-28 [] / 09-29 [OPEN] | Double-complete deduped 200, wrong household 404, missing household/title 422, unknown occurrence 404 | Trash/resources/maintenance still missing | `24dfc5e` |

**Counts:** 1 MVP_READY, 4 MVP_PARTIAL frozen, 3 RUNNABLE_DEMO→MVP_PARTIAL (yomi, majelishub, homeops) = **1 MVP_READY, 7 MVP_PARTIAL, 0 RUNNABLE_DEMO**.

**Evidence dirs (new, not overwriting Wave2):**
- `MVP_AUDIT/wave3/yomi-manga-reader-arch-skeleton/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md,screenshots/5×1440+390}` PGlite `/tmp/yomi-pglite` `/tmp/yomi-storage`
- `MVP_AUDIT/wave3/majelishub-pengajian-event-platform-spec/{…5×…}` PGlite `/tmp/majelis-pglite`
- `MVP_AUDIT/wave3/homeops-household-manager-spec/{…5×…}` PGlite `/tmp/homeops-pglite`

**Prior frozen evidence:** `MVP_AUDIT/progress/*` 8 dirs + `MVP_AUDIT/WAVE2_BASELINE.md` `cc80bac` → `MVP_AUDIT/WAVE3_BASELINE.md` `d5f0974`.
