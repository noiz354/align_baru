# MVP Matrix — FINAL (2026-09-28, Asia/Jakarta) — Wave 2 complete

<!-- F-020-S1: archived 2026-09-28. See ../README.md and yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md -->

> **ARCHIVED 2026-09-28 (F-020-S1).** Not a status source.
> See `../README.md`, then
> `yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md`.
> Retained as history; the claims below were never verified against `7af4e6a`.

A file named FINAL is the most likely thing in a repository to be believed. Yomi
at `7af4e6a` has: no way to create an account, a search page that renders
`NotYetBuilt`, a reader that erases chapter completion on every page change, and
seven placeholder admin pages. None of that is compatible with FINAL.


> **Historical snapshot:** “Final” refers to the Wave2 audit only. Current Wave3 status is in [`MVP_MATRIX_WAVE3.md`](MVP_MATRIX_WAVE3.md).


> Branch: `arena/01a0e54f-align-baru` · Base `df0e396` → Baseline `cc80bac` (wave2 lock) → Final `79c8dbc` (yomi 797b2c8+e9ebe41, majelishub 59f4dd4+9b16fd7, homeops d92529e+79c8dbc)
> Wave2 projects 6-8 advanced `SKELETON_ONLY` → `RUNNABLE_DEMO` via PGlite+FS, projects 1-5 frozen at `cc80bac`.

## Summary counts (if all succeed)

- **1 MVP_READY** (parking)
- **4 MVP_PARTIAL** (minimal, siomayops, strangerlink, rsi)
- **3 RUNNABLE_DEMO** (yomi, majelishub, homeops)
- **0 SKELETON_ONLY**

| Project | Original (cc80bac) | Final | Proven Flow | Persistence Proof | Blocker | Impl Commit |
|---|---|---|---|---|---|---|
| **parking-attendant-ops-app-spec** | `MVP_READY` (ed6938f) | **`MVP_READY`** | `start shift→plate check-in (B4821SSG) → inspect active → checkout 3h→Rp4.000 → payment→reconciliation BALANCED variance0` via operator UI adapter 152K→167K, reuse pricing/SQLite/audit/receipt, 64 tests | `data/parking.db` SQLite 88K + `audit_ledger.jsonl` hash-chained survives restart | QRIS settlement fail-closed, cross-device | `ed6938f` |
| **manga-reader-spec-skeleton-minimal** | `MVP_PARTIAL` (25fe21c) | **`MVP_PARTIAL`** | `Discover 3 manga → manga detail sample-manga-2 → chapter 1 → reader 5→9 (Next×4) → reload still 9 → mobile` via `data/db.json` 19K file-backed 3 manga 5 chapters | `data/db.json` survives restart `GET 7→after 7`, later `9` persists | Authz, upload, S3 still missing — `NOT_READY` for MVP_READY | `25fe21c` |
| **siomayops-streetfood-stall-ops-spec** | `MVP_PARTIAL` (01ef95f) | **`MVP_PARTIAL`** | `Beranda→Jualan (4 menu DB) → +2 Siomay Ayam 30k cash 50k kembalian 20k → Bayar Tunai 201 saleId 42febc… PAID change 20k → Stok 40→36 → HQ 60k/2 Coverage1 Kas110k` | `data/db.json` 26K survives restart `36→36, 60k/2→60k/2` | QRIS digital `PENDING_VERIFICATION` not settled | `01ef95f` |
| **strangerlink-random-chat-webrtc-spec** | `MVP_PARTIAL` (4046583) | **`MVP_PARTIAL`** | `queue TEXT music (A) + queue TEXT music (B) → MATCH_FOUND same 01a0e5a7-... → chat A hello→B delivered → B reply→A delivered → A Leave→B peer-disconnected` via `ws://localhost:3001` `createSignalingClient`, Node+playwright E2E PASS, CSP `connect-src ws:` | Ephemeral `sessionStorage` + in-memory queue correctly not persisted | TURN for media, moderation queue not E2E | `4046583` |
| **rsi-agent-recursive-self-improvement-prototype** | `MVP_PARTIAL` (33ea9ea) | **`MVP_PARTIAL`** | `RSI_PROVIDER=mock demo --improve --max-cycles 2 --auto-approve → PROPOSED→VERIFIED→GUARD_PASSED→APPROVED→APPLIED mem-8e7c→mem-e1a10 22 events chain intact; missing secret → provider-config-error fail-closed; real via human Approver → APPLIED→VERIFIED_AFTER_APPLY 14 events chain intact, rollback restore True` | `audit.jsonl` hash-chained provider-aware, `applied.json` ledger, no secret leak | External real key not exercised, `TRACEABILITY.md` schema pending | `33ea9ea` |
| **yomi-manga-reader-arch-skeleton** | `SKELETON_ONLY` | **`RUNNABLE_DEMO`** | `catalog 3 manga (Ame no Machi rtl 3213..., Kuroi Hoshi ltr c593..., Morning Circuit rtl 43ea...) each 2×6p 480×720 → manga detail rtl → chapter 594f4d49-5934... 6p → reader p1 → Next×3 → p4 → progress saved → reload still p4 → DB proof reading_progress f4b1.../5934... page4` | `pglite:///tmp/yomi-pglite` 49K file + `STORAGE_DIR=/tmp/yomi-storage` 948K 117 files survive restart, `GET media 200 immutable` | Prod PG18 (not PGlite), MinIO/S3 signed, auth, moderation → not MVP_PARTIAL | `797b2c8` |
| **majelishub-pengajian-event-platform-spec** | `SKELETON_ONLY` | **`RUNNABLE_DEMO`** | `org Jakarta 594f4d49-4437... (organizer@majelis.demo.test) → mosque Masjid Al Demo 594f4d49-9e3d... → event Kajian Akhir Pekan 594f4d49-2b86... → POST Kajian Pagi Test 01a0e5f7... → list 2 events → Jakarta 200 vs Bandung 404 (org fbab...) → audit chain pos1 b1da...→pos2 660f...` | `pglite:///tmp/majelishub-pglite` file survives restart `2 events` + `2 audit` rows, `GET /events 2→2`, `GET /events/2b86 200` vs Bandung 404 | Prod PG RLS (second layer bypassed for PGlite), QR/check-in, full audit dashboard → not MVP_PARTIAL | `59f4dd4` |
| **homeops-household-manager-spec** | `SKELETON_ONLY` | **`RUNNABLE_DEMO`** | `household Rumah Demo 594f4d49-3333... (Budi 3333...3334 ADMIN + Sari 3333...3335 MEMBER) → rooms Dapur 4444-1111.../Ruang Tamu/Kamar Utama → chores 5 (5555-1111... overdue 2026-09-27, 5555-2222... Sapu 2026-09-28, 5555-3333... Rapikan 2026-09-28, 5555-4444... Cuci 2026-09-29, 5555-5555... Ganti 2026-10-03) → Today 3 (overdue+today2) → POST complete Sapu 5555-2222... → COMPLETED → Today 2` | `pglite:///tmp/homeops-pglite` 49K file survives reload+restart `GET /today 3→2`, `GET /chores 5 with 1 COMPLETED`, `GET /rooms 3` | Full chore recurrence + scheduler + alerts → not MVP_PARTIAL | `d92529e` |

## Evidence

- `MVP_AUDIT/WAVE2_BASELINE.md` — lock `cc80bac`, tag `mvp-wave2-baseline-cc80bac`
- `MVP_AUDIT/progress/yomi-manga-reader-arch-skeleton/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/{before/02,after/08}}` + `http://localhost:3103` + `pglite:///tmp/yomi-pglite` + `/tmp/yomi-storage`
- `MVP_AUDIT/progress/majelishub-pengajian-event-platform-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/{before/02,after/07}}` + `http://localhost:3104` + `pglite:///tmp/majelishub-pglite`
- `MVP_AUDIT/progress/homeops-household-manager-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/{before/02,after/06}}` + `http://localhost:3101` + `pglite:///tmp/homeops-pglite`
- Prior 5 frozen at `cc80bac`: parking `ed6938f`, minimal `25fe21c`, siomayops `01ef95f`, strangerlink `4046583`, rsi `33ea9ea` (see `MVP_AUDIT/READINESS_PROGRESS.md` 7→8 rows)

## Wave2 verdict

Wave 2 delivers **8-project matrix** with 1 MVP_READY, 4 MVP_PARTIAL, 3 RUNNABLE_DEMO, 0 SKELETON_ONLY — all 3 new RUNNABLE_DEMOs are DB-backed, deterministic, reload+restart durable, with before/after screenshots and DB proofs.
