# OWNERSHIP

## Principle

Two agents may work in parallel when they do not write the same file. The shared files listed below
are the ones that force serialisation; the goal is to shrink that set, not to schedule around it.

## Shared files, and why they are shared

| File | Writers | Why | How to avoid contention |
|---|---|---|---|
| `**/package.json` | any agent adding a dependency or script | one file per project | F-001/F-002/F-005/F-006 need **no** new dependency. If one does, it is a signal that slice is wrong. |
| `**/eslint.config.*`, `ops/eslint/**` | lint-rule work only | gate definition | `F-016` owns the root workflow; per-project lint config changes go with the feature that needs them, one project at a time. |
| `majelishub/tests/support/db.ts`, `database.ts` | F-007 only | the harness | No other feature may edit these. If a feature seems to need a harness change, that is a finding for F-007. |
| `majelishub/tests/integration/security/permissions.test.ts` | F-005 only | the route gate | F-007 must not touch it. |
| `homeops/migrations/meta/_journal.json` | F-004 and F-003 | two migrations | **Serialize.** Land F-004's journal fix first, then F-003 adds exactly one entry. |
| `.github/workflows/project-checks.yml` | F-016 only | one root file | No feature agent edits it. F-007's CI job is delivered *through* F-016, not by editing the workflow. |
| `scripts/check-claims.mjs` | F-016 only | one root file | As above. |
| `AGENTS.md`, `COMPLETION_MATRIX.md` (root) | F-020 only | one file | F-020 runs after F-016. |
| `majelishub/src/server/db/client.ts` | F-003-analogue (none), F-006 (no) | — | homeops `F-003` owns homeops' client. majelishub's client is not modified by any feature in this plan. |

## Per-slice ownership

Each row is a claim on files. If a slice needs a file another active slice owns, that is a scheduling
conflict, not a merge conflict — stop and coordinate.

### siomayops

| Slice | Owns | Shared | Depends on | Parallel safe |
|---|---|---|---|---|
| F-001-S1 | `src/server/auth/port.ts`, `tests/security/unauthenticated.test.ts` | — | — | yes, with everything |
| F-001-S2 | `src/server/auth/session-provider.ts`, `src/server/auth/index.ts`, one new migration | `package.json` only if a driver is added | F-001-S1 | with F-008, F-007, F-005 |
| F-009 | `src/app/api/v1/_helpers.ts` | — | F-001-S2 | no — shares `_helpers.ts` with F-012-analogues |
| F-010 | `src/server/db/memory-store.ts`, `src/server/db/repository.ts`, all repositories | new migrations | F-001-S2, F-009 | **no.** This touches almost everything in siomayops. Run it alone. |

### homeops

| Slice | Owns | Depends on | Parallel safe |
|---|---|---|---|
| F-004-S1 | `migrations/meta/_journal.json`, `migrations/meta/0001_snapshot.json`, `scripts/migrate.ts` | — | with every other project |
| F-004-S2 | `src/server/db/schema-version.ts`, `scripts/seed-wave2-homeops.mjs` | F-004-S1 | with F-002-S1 |
| F-002-S1 | `src/server/auth/require-household.ts` | — | with F-001, F-005, F-008 |
| F-002-S2 | the 4 files under `src/app/api/homeops/**` | F-002-S1 | no — 4 routes, one owner |
| F-002-S3 | 32 page files | F-002-S1 | no — too many files for a second agent; mechanical, keep it in one commit |
| F-002-S4 | `src/server/auth/authorize.ts` | F-002-S2 | with F-003-S1 |
| F-003-S1 | `migrations/0002_row_level_security.sql`, **`migrations/meta/_journal.json`** | F-002-S1, F-004-S1 | **no** — shares the journal with F-004 |
| F-003-S2 | `src/server/db/client.ts`, `tests/integration/security/row-level-security.test.ts` | F-003-S1 | no |
| F-019 | `tests/helpers/db.ts`, `tests/support/**` | — | yes; **must** land before F-002/F-003 are claimed as proved |
| F-018 | all page files, `src/app/styles/**`, remaining lint config | F-002 | **no**, and do it last — it competes for the same pages as F-002-S3 |

### majelishub

| Slice | Owns | Depends on | Parallel safe |
|---|---|---|---|
| F-005-S1 | `api/majelishub/organizations/[orgId]/events/route.ts`, `.../events/[eventId]/route.ts` | — | yes, with everything |
| F-005-S2 | `src/app/dasbor/**`, `tests/integration/security/permissions.test.ts` | F-005-S1 | no |
| F-006-S1 | `src/features/content/public-projections.ts` | F-005-S1 | with F-007 |
| F-006-S2 | the 4 public page files | F-006-S1 | no |
| F-006-S3 | `src/app/styles/README.md`, `tests/unit/**` | F-006-S2 | with F-007 |
| F-007-S1/S2/S3 | `tests/support/**`, `tests/integration/**`, `vitest.config.mts`, `TESTING.md` | — | yes — **test-only, no `src/` overlap** |
| F-012 | `api/v1/events/[eventId]/registrations/route.ts`, `api/v1/checkin/validate/route.ts`, new tests | F-007, F-005 | no |

### manga

| Slice | Owns | Depends on | Parallel safe |
|---|---|---|---|
| F-008-S1 | `src/server/auth/guard.ts`, `src/server/auth/require-admin.ts`, 5 admin pages | — | yes |
| F-008-S2 | `src/app/admin/README.md`, `SECURITY.md`, the guard test | F-008-S1 | with F-007 |
| F-015 | `package.json`, `vitest.config.*`, all of `tests/**` | — | **no** — must not run concurrently with F-008-S2, which adds a test |
| F-017 | `src/server/db/**`, `src/app/api/auth/**` | F-015 | no |

### strangerlink / parking

| Slice | Owns | Depends on | Parallel safe |
|---|---|---|---|
| F-013 | `src/server/db/**`, a new store, `package.json` | — | yes |
| F-014 | `parking/src/server/server.py` (new), `parking/src/infra/static/**` (new), `parking/README.md` | — | yes — **additive only.** It must not modify `src/modules/**`, which is complete and tested. |

### workspace

| Slice | Owns | Depends on | Parallel safe |
|---|---|---|---|
| F-016 | `.github/workflows/project-checks.yml`, `scripts/check-claims.mjs`, `HARNESS.md` | — | no — one owner for the root |
| F-020 | all documentation | F-016 | no |

## Rules for an agent picking up a slice

1. **Confirm the folder is idle.** `yomi-manga-reader-arch-skeleton` is under concurrent development by
   another agent. Touch nothing there.
2. **Run the standing checks before you start** and record the baseline:
   ```
   npm run typecheck && npm run lint && npm test && npm run build
   ```
   A pre-existing failure is not yours to fix in a security slice — note it and continue.
3. **One commit per slice**, with its acceptance test in the same commit (`S-8.4`).
4. **If your slice needs a file another active slice owns, stop.** Coordinate; do not merge.
5. **Never "fix while investigating."** If a slice reveals a new defect, write it into
   `AUDIT_2026-09-28/FEATURE_GAPS.md` and continue with your slice.
6. **Do not touch documentation in a code slice**, except the security document the spec names. F-020
   owns documentation wholesale; conflicting edits are how this repository got here.

## Adding a dependency

Requires a `docs/research/STACK-2026.md` classification in the owning project (majelishub's rule) or
an ADR. **None of the Wave 0 features needs one** — that is a design constraint, not a coincidence.
