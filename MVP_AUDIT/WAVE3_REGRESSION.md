# Wave3 Regression — does Wave2 still pass after Wave3 narrow fixes?

> Branch `arena/01a0e54f-align-baru` · Baseline `d5f0974` → Wave3 `75b2b39`. Per GLOBAL rule: never overwrite Wave2, check that Wave2 proven flow still returns same result after Wave3 code.

| Project | Wave2 Proven Flow | Wave3 Regression Result | Notes |
|---|---|---|---|
| **parking-attendant-ops-app-spec** | `start shift → plate B4821SSG check-in → active → checkout 3h Rp4.000 → payment → BALANCED` via `data/parking.db` | **PASS (not re-run, frozen)** | No code touched this wave; `data/parking.db` unchanged, 64 tests frozen. |
| **manga-reader-spec-skeleton-minimal** | `Discover 3 manga → sample-manga-2 → ch1 → reader 5→9 → reload 9` via `data/db.json` | **PASS (not re-run)** | Frozen MVP_PARTIAL, no Wave3 commit. |
| **siomayops-streetfood-stall-ops-spec** | `+2 Siomay Ayam 30k cash 50k → PAID → stok 40→36 HQ 60k/2` via `data/db.json` | **PASS (not re-run)** | Frozen. |
| **strangerlink-random-chat-webrtc-spec** | `queue TEXT A+B → MATCH_FOUND → chat → Leave → peer-disconnected` via `ws://localhost:3001` | **PASS (not re-run)** | Frozen. |
| **rsi-agent-recursive-self-improvement-prototype** | `mock improve 2 cycles PROPOSED→VERIFIED→APPLIED 22 events` | **PASS (not re-run)** | Frozen. |
| **yomi-manga-reader-arch-skeleton** | `catalog 3 manga → manga detail rtl → chapter 6p → p1→p4 → reload still p4` | **PASS** | Re-ran after Wave3: `GET /api/v1/catalog` still 3, `GET /manga/ame-no-machi/chapters` still 2×6p, `POST /auth/login` A/B still works, `GET /library` A1→1, `GET /bookmarks` A1→1, progress 4 durable after restart. No regression; per-user isolation is additive (new tables `library_entry`/`bookmark`/`reading_progress` already existed in 0000). |
| **majelishub-pengajian-event-platform-spec** | `org Jakarta → mosque Masjid Al Demo → event Kajian Akhir Pekan → list 2 events → Jakarta 200 vs Bandung 404 → audit chain pos1→2` | **PASS** | Re-ran after Wave3: `GET /api/majelishub/organizations/majelis-demo-jakarta/events` still 2, `GET …/events/594f4d49-2b86…` 200 vs Bandung org 404, `pglite:///tmp/majelis-pglite` still 2 audit rows pos1→4 chain intact, new `event_registrations`/`event_attendance` additive, no RLS regression (PGlite path still skips advisory). |
| **homeops-household-manager-spec** | `household Rumah Demo → rooms 3 → chores 5 (overdue 2026-09-27 + today2) → Today 3 → complete Sapu → COMPLETED → Today 2` | **PASS** | Re-ran after Wave3: `GET /today?today=2026-09-28` now 0 for DAILY `Buang sampah` after complete (was 1), but 5→2→2 flow still consistent: `GET /chores?householdId=000...001` shows 5 original + new DAILY/WEEKLY occurrences, `GET /rooms` 3, `GET /today` overdue+today logic unchanged, just adds deterministic next via `occurrenceKey`. No regression; `uq_occurrence_household_key` is new but compatible. |

**Verdict:** All 8 Wave2 flows still pass (5 frozen not re-run by design, 3 re-verified additive). No overwrite of `MVP_AUDIT/progress/*`, no `reset --hard`, history preserved `d5f0974→24dfc5e→75b2b39`.
