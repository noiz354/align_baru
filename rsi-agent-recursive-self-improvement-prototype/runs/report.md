# RSI Agent -- Run Report

_Generated: 2026-09-26 16:59:19 | seed: 0 | judge: mock-jev_

## Architecture executed

```
Curriculum Agent ──propose──► Actor Agent (ReAct loop) ──result──► Verifier Agent
       ▲                                                              │
       └──────────────── persistent memory ◄── lesson ────────────────┘
        BRS (broad) → DRS (deep, targeted at weak keys) → FREEZE → test-time
  Jev decisions: guard(Noul) · route(Choice) · score(Score) · done(Noul)
```

## Phase metrics

| Phase | Tasks | Success | Rate | Avg score | Escalated | Memory |
|---|---|---|---|---|---|---|
| BRS wave 1/2 | 6 | 1/6 | 17% | 0.64 | 0 | 6 |
| BRS wave 2/2 | 6 | 4/5 | 80% | 0.91 | 1 | 11 |
| DRS round 1/2 | 4 | 3/4 | 75% | 0.89 | 0 | 15 |
| DRS round 2/2 | 4 | 3/4 | 75% | 0.89 | 0 | 19 |
| TEST cold (empty memory) | 12 | 1/11 | 9% | 0.61 | 1 | 0 |
| TEST warm (frozen memory) | 12 | 7/11 | 64% | 0.84 | 1 | 19 |

## Cold vs warm (identical holdout tasks)

| Condition | Success rate | Avg score |
|---|---|---|
| Cold (empty memory) | 9% | 0.61 |
| Warm (frozen memory) | 64% | 0.84 |

The delta is the RSI effect: experience written during exploration is reused verbatim at test time, with model parameters untouched.

## Persistent memory (19 lessons, frozen=True)

Knowledge keys covered (21): api-design, argparse, async, clarity, cli, debugging, docs, edge-cases, fixtures, golden, http, logging, migrations, pytest, refactor, review, safety, schema, security, sql, typing

### Sample verified lessons
- `procedure` (conf 0.9, keys: debugging, logging, edge-cases): [procedure] 'Fix failing test in payment retry logic': applying debugging, logging, edge-cases with tests-before-patch then tests-after-patch completed the task.
- `boundary` (conf 0.6, keys: api-design, http): [boundary] 'Add pagination to /users endpoint': hidden constraint around 'api-design' defeated a first-pass fix. Before finalizing work in this area, probe api-design boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `boundary` (conf 0.6, keys: fixtures, pytest): [boundary] 'Raise coverage for invoice proration': hidden constraint around 'fixtures' defeated a first-pass fix. Before finalizing work in this area, probe fixtures boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `boundary` (conf 0.6, keys: refactor, typing): [boundary] 'Extract currency conversion into a service': hidden constraint around 'refactor' defeated a first-pass fix. Before finalizing work in this area, probe refactor boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `boundary` (conf 0.6, keys: argparse, cli): [boundary] 'Add --dry-run flag to migration CLI': hidden constraint around 'argparse' defeated a first-pass fix. Before finalizing work in this area, probe argparse boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `boundary` (conf 0.6, keys: migrations, sql): [boundary] 'Normalize address table and write migration': hidden constraint around 'migrations' defeated a first-pass fix. Before finalizing work in this area, probe migrations boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).

## Escalated to human workflow

- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'

## Artifacts

- `runs/memory.json` -- persistent memory store (procedures + boundary lessons)
- `runs/attempts.jsonl` -- full ReAct traces per attempt
- `runs/report.md` -- this file
