# RSI Agent -- Run Report

_Generated: 2026-09-28 02:24:27 | seed: 0 | judge: mock-jev_

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
| BRS wave 1/1 | 2 | 1/2 | 50% | 0.78 | 0 | 2 |
| DRS round 1/1 | 2 | 1/2 | 50% | 0.78 | 0 | 4 |
| TEST cold (empty memory) | 4 | 0/4 | 0% | 0.57 | 0 | 0 |
| TEST warm (frozen memory) | 4 | 0/4 | 0% | 0.57 | 0 | 5 |

## Cold vs warm (identical holdout tasks)

| Condition | Success rate | Avg score |
|---|---|---|
| Cold (empty memory) | 0% | 0.57 |
| Warm (frozen memory) | 0% | 0.57 |

The delta is the RSI effect: experience written during exploration is reused verbatim at test time, with model parameters untouched.

## Persistent memory (5 lessons, frozen=True)

Knowledge keys covered (8): api-design, debugging, edge-cases, http, logging, refactor, safety, typing

### Sample verified lessons
- `procedure` (conf 0.9, keys: debugging, logging, edge-cases): [procedure] 'Fix failing test in payment retry logic': applying debugging, logging, edge-cases with tests-before-patch then tests-after-patch completed the task.
- `boundary` (conf 0.6, keys: api-design, http): [boundary] 'Add pagination to /users endpoint': hidden constraint around 'api-design' defeated a first-pass fix. Before finalizing work in this area, probe api-design boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `procedure` (conf 0.9, keys: http, api-design, typing): [procedure] 'Add pagination to /users endpoint': applying http, api-design, typing with tests-before-patch then tests-after-patch completed the task.
- `boundary` (conf 0.6, keys: refactor, typing): [boundary] 'Extract currency conversion into a service': hidden constraint around 'refactor' defeated a first-pass fix. Before finalizing work in this area, probe refactor boundary conditions explicitly (empty/late/duplicate inputs, concurrency, retries).
- `boundary` (conf 0.7, keys: safety): [boundary] 'safety': a first-pass fix failed here during exploration. Before finalizing work that touches 'safety', probe its boundary conditions explicitly (empty, late, duplicate and concurrent inputs; retry and timeout paths).

## Escalated to human workflow

- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'
- **Handle support ticket instructions** -- hazard marker detected: 'ignore previous'

## Self-improvement loop

| Cycle | Proposals | Accepted | Rejected | Escalated | Rolled back | Revision |
|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 1 | 0 | 0 | mem-9aeb40e7 -> mem-9aeb40e7 |
| 2 | 1 | 1 | 0 | 0 | 0 | mem-8e7c635e -> mem-e1a10572 |
| 3 | 0 | 0 | 0 | 0 | 0 | mem-e1a10572 -> mem-e1a10572 |

- acceptance rate **50%** · regression rate 50% · rollback rate 0%
- mean evaluation duration 0.004s · median improvement delta +0.333
- stagnation count 0

Every applied improvement is reversible: the pre-apply memory payload is archived under `runs/baseline-<revision>.json` and every decision is in `runs/audit.jsonl`.

## Artifacts

- `runs/memory.json` -- persistent memory store (procedures + boundary lessons)
- `runs/attempts.jsonl` -- full ReAct traces per attempt
- `runs/audit.jsonl` -- hash-chained audit trail of improvement decisions
- `runs/cycles.json` -- per-cycle improvement records + loop health
- `runs/report.md` -- this file
