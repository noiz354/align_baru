# Load and performance harness (T-PERF-001)

Not implemented in Phase 0. This directory will hold the harness that measures the budgets in
`PERFORMANCE.md` (P1-P40) and feeds `docs/operations/SLO.md`.

Scenarios:

1. **Entrance burst** - N devices scanning against a seeded event; measures `checkin_duration_ms`
   p50/p95/p99, throughput per device and per event, and shed behaviour (P11-P16).
2. **Registration contention** - many parallel submissions for the last seats; asserts one winner per
   seat and honest loser outcomes (C1).
3. **Upload concurrency** - parallel chunk uploads with induced failures; measures backlog behaviour and
   eventual convergence (C7/C8).
4. **Public pages on 3G** - discovery and event detail under CDP throttling (P1-P4).

Rules: never against production · synthetic data only · short-lived dedicated principals · every run
records the hardware class (absolute numbers are meaningless without it) · a run whose variance is
unexplained is reported as INCONCLUSIVE, never as a pass.
