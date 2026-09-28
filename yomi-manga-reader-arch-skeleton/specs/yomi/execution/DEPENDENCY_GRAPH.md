# Yomi — Dependency Graph

**Status:** canonical. The answer to *"what should be implemented next?"* — derived,
not asked.

Nodes are slice IDs from [MASTER_PLAN.md](MASTER_PLAN.md). Marked `PARALLEL_SAFE`
where a slice shares no file with any concurrent slice, and `BLOCKING` where other
work waits on it.

## The graph

```
                        ┌──────────────────────────────┐
                        │ WAVE 0 — GATE TRUTH          │
                        │ F-022-S1  NODE_ENV pin       │  INDEPENDENT
                        │ F-023-S1  checker coverage   │  INDEPENDENT
                        │ F-020-S1  archive stale docs │  INDEPENDENT
                        │ F-024-S1  traceability hdrs  │  INDEPENDENT
                        └───────────────┬──────────────┘
                                        │ everything below trusts the gate
                                        ▼
        ┌───────────────────────────────────────────────────────────┐
        │ F-001-S1  one getOrCreateDb per process   ══ BLOCKING ══  │
        │ F-001-S2  getSessionUser takes the handle                │
        │   a single members' request opens up to THREE pools now   │
        └───────┬───────────────────────────────────┬───────────────┘
                │                                   │
    ┌───────────▼─────────────┐        ┌────────────▼──────────────┐
    │  AUTH TRACK — DEFERRED  │        │  WAVE 2 — SEARCH  ★        │
    │  F-002 session store    │        │  F-010-S1 4 rank bands    │
    │  F-003 registration     │        │  F-010-S2 related + CJK   │
    │  F-004 sign-in UI       │        │  F-011-S1 service         │
    │  F-005 ROUTE GUARD      │        │  F-011-S2 GET /api/search │
    │    └─ blocks F-016/017  │        │  F-012-S1 /search page    │
    │       routes forever    │        │  F-012-S2 query in URL    │
    │  F-002 → F-003 → F-004  │        │  PARALLEL_SAFE: no auth,  │
    │  F-002 → F-005          │        │  no shared file          │
    └─────────────────────────┘        └───────────────────────────┘

        ┌───────────────────────────────────────────────────────────┐
        │ WAVE 3 — READER NAV              PARALLEL_SAFE (W2)      │
        │ F-007-S1  prev/next chapter       needs no session       │
        │ F-007-S2  ?page=N deep link                                 │
        └───────────────────────────────────────────────────────────┘

        ┌───────────────────────────────────────────────────────────┐
        │ WAVE 4 — READER CORRECTNESS  ══ carries the P0 ══          │
        │ F-006-S1  route → ReaderProgressRepository  ══ BLOCKING ══ │
        │ F-006-S2  delete queries/reader-state.ts    ══ BLOCKING ══ │
        │ F-008-S1  unsetCompleted (port + repo)                     │
        │ F-009-S1  /api/v1 real caller resolver                     │
        │   F-006 must precede F-008: the repository is what F-006   │
        │   routes through, and the second writer is the erasure bug  │
        └───────────────────────────────────────────────────────────┘

        ┌───────────────────────────────────────────────────────────┐
        │ WAVE 5 — CONTENT SERVICES     SERVICE LAYER ONLY           │
        │ F-016-S1  AdminService manga CRUD     no route, no page    │
        │ F-016-S2  AdminService chapter CRUD   no route, no page    │
        │ F-017-S1  single-part upload service no route, no page    │
        │ F-013-S1/S2  reader_preference       self-scoped route OK │
        │   all three blocked from ROUTING by F-005 (deferred)       │
        └───────────────────────────────────────────────────────────┘

        ┌───────────────────────────────────────────────────────────┐
        │ WAVE 6 — ASSURANCE                                       │
        │ F-021-S1  5 e2e specs into CI   needs stable journeys    │
        └───────────────────────────────────────────────────────────┘
```

## Classifications

### BLOCKING

| Slice | Blocks | Why |
|---|---|---|
| **F-001-S1** | every composition change | Two roots each open a connection; a third opens per call. A shared-handle change after other work means re-doing that work. |
| **F-006-S1** | F-008-S1, and J-10 forever | It is the P0. The reader's write path must go through the repository that owns the invariant. |
| **F-006-S2** | any further progress work | The file is the defect *and* the bypass. It must be deleted, not patched. |

### PARALLEL_SAFE

| Slice | Safe against | Because |
|---|---|---|
| F-010 … F-012 | the whole auth track and all of F-001 | Search needs no session, no `middleware.ts`, no shared port. Its own `repositories/search.repository.ts`, `api/search/`, `app/search/`. |
| F-007-S1/S2 | F-010…F-012 | Different route directory; `pageList` already returns the neighbours. |
| F-020, F-022, F-023, F-024 | everything | Docs, one config line, one script, comments. |

### INDEPENDENT

`F-020-S1` (docs) · `F-022-S1` (vitest config) · `F-024-S1` (comments).

### BLOCKED_BY

| Slice | Blocked by | Note |
|---|---|---|
| F-016 routes, F-017 routes | **F-005** (deferred) | Not cancelled — prohibited. An unguarded admin route is a P0 regression. |
| F-008-S2 | F-002 (session store) + F-006 | Needs a real caller and a real write path |
| F-009-S1 | F-002 for the *browser* proof | The resolver is non-auth code and testable with an injected caller; the browser proof needs a session, which a seeded account provides |
| F-021-S1 | stable J-03, J-06, J-07 | An e2e spec for a journey that still 500s is noise |
| F-018, F-019 | F-016 + F-005 | Post-MVP |

## Serial versus parallel, stated plainly

**Serial, one at a time, because they touch the runtime root:**
`F-001-S1` → `F-001-S2` → `F-006-S1` → `F-006-S2` → `F-008-S1`

**Everything else may run concurrently with those**, provided the lanes stay disjoint:

```
lane 1 (runtime, serial)   F-001 → F-006 → F-008
lane 2 (search)            F-010 → F-011 → F-012          no auth
lane 3 (reader nav)        F-007                          no session
lane 4 (content services)  F-016 → F-017 → F-013          no routes
lane 5 (gate truth)        F-022, F-023, F-020, F-024     no code overlap
```

## What the graph says to do next

The first unchecked slice in [CHECKLIST.md](CHECKLIST.md) whose dependencies are
satisfied. With a clean tree at `7af4e6a` that is **F-022-S1** — it depends on
nothing, it is 5 lines in 1 file, and every other slice's verification number depends
on the harness being deterministic.
