# specs/ — canonical specification for this workspace

Everything a coding agent needs in order to pick up exactly one slice and implement it without
rediscovering product intent, security rules, architecture, affected modules, acceptance criteria,
dependencies, or ownership boundaries.

## Read in this order

| # | File | What it is |
|---|---|---|
| 1 | [`PRODUCT.md`](PRODUCT.md) | one page per project: the user, the job, the non-goals, the current status word, and what was explicitly rejected |
| 2 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | the five patterns that already work here and should be reused; the seven that must not be copied |
| 3 | [`SECURITY.md`](SECURITY.md) | the security contract. Every rule traces to a measured defect or a control that works. Includes the standing verification command. |
| 4 | [`DATA_MODEL.md`](DATA_MODEL.md) | measured store, tenant column, RLS and transaction state per project; the cross-project rule that keeps being violated |
| 5 | [`execution/DEPENDENCY_GRAPH.md`](execution/DEPENDENCY_GRAPH.md) | the feature register, the graph, the critical path, and the brief for every Wave 1–2 feature |
| 6 | [`execution/IMPLEMENTATION_ORDER.md`](execution/IMPLEMENTATION_ORDER.md) | Wave 0 → 4, with exit criteria and a suggested first week |
| 7 | [`execution/OWNERSHIP.md`](execution/OWNERSHIP.md) | which files each slice owns, which are shared, and what is parallel-safe |

Then open exactly one `features/F-0xx-*/`.

## Feature specs

| ID | Feature | Priority | Wave |
|---|---|---|---|
| F-001 | siomayops: real session resolution; remove the inverted production guard | P0 | 0 |
| F-002 | homeops: tenant context derived from the session | P0 | 0 |
| F-003 | homeops: row-level security on every tenant table | P0 | 0 |
| F-004 | homeops: migration journal + boot-time schema check | P0 | 0 |
| F-005 | majelishub: remove the request-header identity | P0 | 0 |
| F-006 | majelishub: public projection for kajian and masjid pages | P0 | 0 |
| F-007 | majelishub: test harness isolation + driver parity | P1 | 1 (parallel) |
| F-008 | manga: admin authorization boundary | P0 | 0 |

Each has `SPEC.md` (intent, scope, rules, data, API, error behaviour, migration, rollback),
`ACCEPTANCE.md` (executable criteria only) and `IMPLEMENTATION.md` (ordered slices with do-not-touch
lists). Wave 1–2 features have their intent, scope, non-goals and acceptance fixed as briefs in
[`execution/DEPENDENCY_GRAPH.md`](execution/DEPENDENCY_GRAPH.md); their full triple is written when
the slice is scheduled.

## Decisions

| ADR | Title | Status |
|---|---|---|
| [ADR-001](decisions/ADR-001-evidence-only-on-production-stack.md) | Completion evidence is produced only on the production stack | Accepted |
| [ADR-002](decisions/ADR-002-siomayops-persistence.md) | siomayops money state moves out of process memory | Proposed |
| [ADR-003](decisions/ADR-003-documentation-is-claim-until-verified.md) | Documentation is a claim until a command settles it | Accepted |

## The ground truth these specs are built on

[`../AUDIT_2026-09-28/`](../AUDIT_2026-09-28/):

- `REAL_AUDIT_SUMMARY.md` — status criteria, the scoreboard, and the five findings that dominate
- `projects/*/REALITY_AUDIT.md` — one per project, with evidence IDs
- `FEATURE_REALITY_MATRIX.md` — derived from code, not from `TASKS.md`
- `USER_JOURNEYS.md` — `UJ-XXX`, with the current truth for each
- `FEATURE_GAPS.md` — P0…P3, and the feature-inflation list
- `SECURITY_GAPS.md` — every item pointing to running code or a captured request
- `PERSISTENCE_REALITY.md` — create → read → update → restart → read, measured
- `TEST_EXECUTION.md` — actual runner output, with the documented claims compared
- `DOCUMENTATION_RECONCILIATION.md` — KEEP / UPDATE / ARCHIVE / DELETE per document
- `evidence/` — raw command captures

## Two rules an agent must not break

1. **Do not work in `yomi-manga-reader-arch-skeleton`.** Another agent is active there.
2. **Do not "fix while investigating."** If a slice reveals a new defect, add it to
   `AUDIT_2026-09-28/FEATURE_GAPS.md` and finish your slice. The defects in this repository
   accumulated because each was patched inside someone else's change.
