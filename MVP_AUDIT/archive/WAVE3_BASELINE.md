# Wave 3 Baseline — d5f0974

<!-- F-020-S1: archived 2026-09-28. See ../README.md and yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md -->

> **ARCHIVED 2026-09-28 (F-020-S1).** Not a status source.
> See `../README.md`, then
> `yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md`.
> Retained as history; the claims below were never verified against `7af4e6a`.

Yomi is graded `MVP_PARTIAL` here and `MVP_READY` elsewhere in this archive
for other projects. The grade is defined against nothing, and at `7af4e6a` the P0s
it should have caught — no account creation, completion erasure — are both open.


> **Plan snapshot:** This records the Wave3 plan before implementation. Its commit ancestry claims are historical audit notes; this PR checkout started from shallow/grafted base `df0e396`. Current status and implementation hashes are in [`MVP_MATRIX_WAVE3.md`](MVP_MATRIX_WAVE3.md).


**Branch:** `arena/01a0e54f-align-baru`
**HEAD:** `d5f097401f7a331a4e2d40a4710a7dbbefa8f9a3` (`d5f0974`)
**Tag:** `mvp-wave3-baseline-d5f0974` (local)
**Date:** 2026-09-28 Asia/Jakarta
**Baseline audit:** `cc80bac` Wave2 locked → Wave2 complete at `d5f0974` → Wave3 locked at `d5f0974`

## Readiness — all 8 projects

| # | Project | Wave2 State | Wave3 Target | Status |
|---|---------|-------------|--------------|--------|
| 1 | `parking-attendant-ops-app-spec` | `MVP_READY` | hardening (idempotency) | frozen MVP_READY, optional fix |
| 2 | `manga-reader-spec-skeleton-minimal` | `MVP_PARTIAL` | `MVP_PARTIAL→MVP_READY?` (auth-isolated progress) | to implement |
| 3 | `siomayops-streetfood-stall-ops-spec` | `MVP_PARTIAL` | `MVP_PARTIAL→MVP_READY?` (QRIS idempotent callback) | to implement |
| 4 | `strangerlink-random-chat-webrtc-spec` | `MVP_PARTIAL` | `MVP_PARTIAL→MVP_READY?` (real AUDIO WebRTC) | to implement |
| 5 | `rsi-agent-recursive-self-improvement-prototype` | `MVP_PARTIAL` | `MVP_PARTIAL→MVP_READY or unchanged` (bounded repo patch workflow) | to implement |
| 6 | `yomi-manga-reader-arch-skeleton` | `RUNNABLE_DEMO` (797b2c8) | `RUNNABLE_DEMO→MVP_PARTIAL` (auth-isolated library/bookmark/progress) | priority |
| 7 | `majelishub-pengajian-event-platform-spec` | `RUNNABLE_DEMO` (59f4dd4) | `RUNNABLE_DEMO→MVP_PARTIAL` (attendee registration→QR→idempotent check-in) | priority |
| 8 | `homeops-household-manager-spec` | `RUNNABLE_DEMO` (d92529e) | `RUNNABLE_DEMO→MVP_PARTIAL` (recurring chore lifecycle) | priority |

**Wave2 history preserved:** 1 MVP_READY (parking), 4 MVP_PARTIAL (minimal, siomayops, strangerlink, rsi), 3 RUNNABLE_DEMO (yomi, majelishub, homeops), 0 SKELETON_ONLY. No resets, no squashes, no amends.

**Wave3 objective:** remove biggest demo-only boundaries (per-user isolation, idempotency, negative paths, realtime lifecycle, recovery) — one important boundary per project. Truthful unchanged status acceptable.

## Known evidence directories at baseline

**Wave2 progress (frozen, do not alter except regression notes):**
- `MVP_AUDIT/progress/parking-attendant-ops-app-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/08}` + `data/parking.db`
- `MVP_AUDIT/progress/manga-reader-spec-skeleton-minimal/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/08}` + `data/db.json`
- `MVP_AUDIT/progress/siomayops-streetfood-stall-ops-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/08,screenshots/after/09}` + `data/db.json`
- `MVP_AUDIT/progress/strangerlink-random-chat-webrtc-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/07,screenshots/after/07}` + `ws://localhost:3001`
- `MVP_AUDIT/progress/rsi-agent-recursive-self-improvement-prototype/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/01,screenshots/after/02}` + `runs-*`
- `MVP_AUDIT/progress/yomi-manga-reader-arch-skeleton/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/08}` + `pglite:///tmp/yomi-pglite` 49K + `/tmp/yomi-storage` 948K
- `MVP_AUDIT/progress/majelishub-pengajian-event-platform-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/07}` + `pglite:///tmp/majelishub-pglite`
- `MVP_AUDIT/progress/homeops-household-manager-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/06}` + `pglite:///tmp/homeops-pglite` 49K
- `MVP_AUDIT/WAVE2_BASELINE.md` tag `mvp-wave2-baseline-cc80bac`
- `MVP_AUDIT/MVP_MATRIX_FINAL.md` Wave2 final (d5f0974) + `MVP_AUDIT/MVP_MATRIX_AFTER.md` + `MVP_AUDIT/READINESS_PROGRESS.md` (8 rows)

**Wave3 evidence to be created (do not overwrite Wave2):**
- `MVP_AUDIT/wave3/<project>/{BASELINE.md,IMPLEMENTATION.md,RUNTIME_PROOF.md,FAILURE_CASES.md,READINESS.md,screenshots/}`
- `MVP_AUDIT/MVP_MATRIX_WAVE3.md` (do not overwrite `MVP_MATRIX_FINAL.md`)
- `MVP_AUDIT/WAVE3_REGRESSION.md` (`Project|Wave2 Proven Flow|Wave3 Regression Result|Notes`)
- `MVP_AUDIT/WAVE3_BASELINE.md` (this file) + tag `mvp-wave3-baseline-d5f0974`

**Implementation commits frozen (Wave2):**
- `ed6938f/d7ab082` parking MVP_READY, `25fe21c/5a74fdf` minimal MVP_PARTIAL, `01ef95f/4393775` siomayops MVP_PARTIAL, `4046583` strangerlink MVP_PARTIAL, `33ea9ea` rsi MVP_PARTIAL
- `797b2c8/e9ebe41` yomi RUNNABLE_DEMO, `59f4dd4/9b16fd7` majelishub RUNNABLE_DEMO, `d92529e/79c8dbc` homeops RUNNABLE_DEMO
- docs chain `9482dcb→5781970→cc80bac→cf8e6ea→d5f0974` (wave2 complete)

## Freeze statement

> From `d5f0974` forward Wave2 history is **frozen** (history preservation > cosmetic cleanliness). Do NOT `reset --hard <old>`, `rebase -i`, `commit --amend`, `push --force` for cleanup. Per-project Wave3: 1 implementation commit + optional evidence/docs commit, then ONE final `docs: finalize wave3 MVP readiness audit`. Negative-path verification mandatory (≥3 paths unless fewer exist). Visual screenshots only when state matters; DB/API/terminal proof for idempotency/concurrency.

## Next work order (priority)

1. yomi — auth-isolated library/bookmark/progress (users `reader.a@example.test`/`reader.b@example.test`, User A progress 4 vs User B 0, library ≥1 vs 0, unauth/reject paths)
2. majelishub — attendee `attendee@majelis.demo.test` registration→QR/token→idempotent attendance (duplicate scan exactly once, tenant/event isolation)
3. homeops — recurring `Buang sampah` weekly (daily/weekly) lifecycle with idempotent completion → next occurrence once
4. minimal — login→user-owned progress isolation (A page9 vs B independent, logout/login restores)
5. siomayops — QRIS PENDING→signed callback→PAID exactly-once stock/HQ, HMAC invalid→rejected, replay→no duplicate
6. strangerlink — real AUDIO WebRTC (offer/answer/ICE/connected→remote track→disconnect) + report/block
7. rsi-agent — bounded repo patch inside sandbox (proposal→verifier→guard→approval→apply→tests→audit→rollback, path traversal & secret leak rejected)
8. parking — hardening checkout/payment idempotency (concurrent duplicate → one stay/fee/payment/receipt)

**Verified:**
- `git status` clean except untracked `data/` + `runs-evidence*` + `package-lock.json` (not committed per Wave2 discipline)
- `git log --oneline -15` ends at `d5f0974`
- `git rev-parse HEAD` → `d5f097401f7a331a4e2d40a4710a7dbbefa8f9a3`
- `git tag mvp-wave3-baseline-d5f0974` points to `d5f0974`
