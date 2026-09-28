# Wave 2 Baseline — cc80bac

> **Archive note:** Historical Wave2 baseline snapshot. Commit/tag references below are audit provenance, not the current branch tip; the PR checkout started from shallow/grafted base `df0e396`. Current implementation hashes are listed in [`MVP_MATRIX_WAVE3.md`](MVP_MATRIX_WAVE3.md).


**Branch:** `arena/01a0e54f-align-baru`
**HEAD:** `cc80bac3b5196f41dc1a341ddf63f11f6dfdd778` (`cc80bac`)
**Tag:** `mvp-wave2-baseline-cc80bac` (local)
**Date:** 2026-09-28 Asia/Jakarta
**Baseline audit:** `7641230` → Wave 1 verified at `d85371c` → Wave 2 locked at `cc80bac`

## Readiness — all 8 projects

| # | Project | Current | Target Wave 2 | Status |
|---|---------|---------|---------------|--------|
| 1 | `parking-attendant-ops-app-spec` | `MVP_READY` | — (frozen) | accepted |
| 2 | `manga-reader-spec-skeleton-minimal` | `MVP_PARTIAL` | — (frozen) | accepted |
| 3 | `siomayops-streetfood-stall-ops-spec` | `MVP_PARTIAL` | — (frozen) | accepted |
| 4 | `strangerlink-random-chat-webrtc-spec` | `MVP_PARTIAL` | — (frozen) | accepted |
| 5 | `rsi-agent-recursive-self-improvement-prototype` | `MVP_PARTIAL` | — (frozen) | accepted |
| 6 | `yomi-manga-reader-arch-skeleton` | `SKELETON_ONLY` | `RUNNABLE_DEMO` | to implement |
| 7 | `majelishub-pengajian-event-platform-spec` | `SKELETON_ONLY` | `RUNNABLE_DEMO` | to implement |
| 8 | `homeops-household-manager-spec` | `SKELETON_ONLY` | `RUNNABLE_DEMO` | to implement |

**Frozen set (1–5):** Do NOT reimplement, do NOT squash, do NOT force-push. Only regression fixes allowed. Evidence dirs below are authoritative and must not be altered except to add regression smoke notes.

**Active wave (6–8):** Implement narrow vertical slices only, per `AGENTS.md` wave instructions. Promotion `SKELETON_ONLY → RUNNABLE_DEMO` requires DB-backed runtime proof + screenshots + audit update.

## Known evidence directories at baseline

**Per-project audit docs:**
- `MVP_AUDIT/projects/parking-attendant-ops-app-spec/AUDIT.md` → `MVP_READY`
- `MVP_AUDIT/projects/manga-reader-spec-skeleton-minimal/AUDIT.md` → `MVP_PARTIAL`
- `MVP_AUDIT/projects/siomayops-streetfood-stall-ops-spec/AUDIT.md` → `MVP_PARTIAL`
- `MVP_AUDIT/projects/strangerlink-random-chat-webrtc-spec/AUDIT.md` → `MVP_PARTIAL`
- `MVP_AUDIT/projects/rsi-agent-recursive-self-improvement-prototype/AUDIT.md` → `MVP_PARTIAL`
- `MVP_AUDIT/projects/yomi-manga-reader-arch-skeleton/AUDIT.md` → `SKELETON_ONLY`
- `MVP_AUDIT/projects/majelishub-pengajian-event-platform-spec/AUDIT.md` → `SKELETON_ONLY`
- `MVP_AUDIT/projects/homeops-household-manager-spec/AUDIT.md` → `SKELETON_ONLY`

**Progress evidence (before → after):**
- `MVP_AUDIT/progress/parking-attendant-ops-app-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/08}` (DB `parking.db` 88K, UI 152K→167K)
- `MVP_AUDIT/progress/manga-reader-spec-skeleton-minimal/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/02,screenshots/after/08}` (file `data/db.json` 19K)
- `MVP_AUDIT/progress/siomayops-streetfood-stall-ops-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/06,screenshots/after/08}` (file `data/db.json` 26K)
- `MVP_AUDIT/progress/strangerlink-random-chat-webrtc-spec/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/07,screenshots/after/07}` (ws `ws://localhost:3001`, Node+playwright PASS)
- `MVP_AUDIT/progress/rsi-agent-recursive-self-improvement-prototype/{BEFORE.md,AFTER.md,CHANGES.md,screenshots/before/01,screenshots/after/02}` (mock 22 events + real-provider 14 events)
- `MVP_AUDIT/progress/yomi-manga-reader-arch-skeleton/` — *not yet created* (SKELETON_ONLY)
- `MVP_AUDIT/progress/majelishub-pengajian-event-platform-spec/` — *not yet created* (SKELETON_ONLY)
- `MVP_AUDIT/progress/homeops-household-manager-spec/` — *not yet created* (SKELETON_ONLY)

**Matrix docs:**
- `MVP_AUDIT/MVP_MATRIX.md` (baseline 7641230)
- `MVP_AUDIT/MVP_MATRIX_AFTER.md` → HEAD `HEAD (d85371c)` (Wave 1 + rsi 33ea9ea)
- `MVP_AUDIT/READINESS_PROGRESS.md` (5 rows → rsi 33ea9ea)
- `MVP_AUDIT/READINESS_PROGRESS.md` history preserved, not replaced

**Implementation commits frozen:**
- `ed6938f` / `d7ab082` parking → MVP_READY
- `25fe21c` / `5a74fdf` minimal → MVP_PARTIAL
- `01ef95f` / `4393775` siomayops → MVP_PARTIAL
- `4046583` strangerlink → MVP_PARTIAL
- `33ea9ea` rsi → MVP_PARTIAL
- docs chain `9482dcb` → `5781970` → `cc80bac` (hash alignment, not squashed)

## Freeze statement

> Projects 1–5 are **frozen** at `cc80bac`. From this point forward `history preservation > cosmetic commit cleanliness`. Do NOT `reset --hard`, `rebase -i`, `commit --amend`, or `push --force` unless repository becomes genuinely unrecoverable. Documentation hash staleness is normal — record new milestones in new commits only.

## Next work

6. `yomi-manga-reader-arch-skeleton` — catalog→manga→chapter→reader→progress via Postgres + storage (seed: `reader.demo@example.test`, 3 manga × ≥2 chapters × ≥5 pages, deterministic images).
7. `majelishub-pengajian-event-platform-spec` — organization→mosque→event with RLS/audit (tenants Jakarta/Bandung, event `Kajian Akhir Pekan`).
8. `homeops-household-manager-spec` — household→rooms→chores→Today→complete (household `Rumah Demo`, 5 chores with overdue/today/tomorrow/later).

Then final regression smoke across all 8 and `MVP_AUDIT/MVP_MATRIX_FINAL.md`.

**Verified:**
- `git status` clean except untracked `data/` + `runs-evidence*` (intentionally not committed)
- `git log --oneline -15` ends at `cc80bac`
- `git rev-parse HEAD` → `cc80bac3b5196f41dc1a341ddf63f11f6dfdd778`
- `git tag mvp-wave2-baseline-cc80bac` points to `cc80bac`
