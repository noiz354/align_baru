# How the fixture sets are used

This file is the map between fixtures and test layers, so a future agent knows what to seed and why.

| Suite | Fixture set | Why this size |
|---|---|---|
| `tests/unit/**` | `tiny/` (as data builders, no database) | unit tests must be fast and deterministic |
| `tests/integration/attendance/duplicate*.test.ts` | `tiny/` + forced interleaving | the invariant (one row) is what is asserted |
| `tests/integration/registration/capacity-race.test.ts` | `tiny/` with capacity = 1 | makes the loser outcomes observable |
| `tests/integration/security/isolation.test.ts` | `multitenant/` | needs two organizations with overlapping slugs |
| `tests/integration/media/*` | `tiny/` audio + generated 2 h timeline | assembly must be exercised beyond a single chunk |
| `tests/e2e/recording-survival.spec.ts` | generated 2 h timeline | recovery behaviour only appears at scale |
| `tests/e2e/entrance-drill.spec.ts` | `event-L/` (320 registrations) | realistic entrance pressure |
| `tests/e2e/transcription-review-publish.spec.ts` | `providers/` recordings + `multilingual/` | Arabic and code-switching must be present, not assumed |
| `ops/load/**` (T-PERF-001) | `event-XL/` generated on demand | keeps the repository small |

Rules: fixtures are seeded through the same repositories/services a real flow uses wherever possible -
hand-written rows hide bugs in the write path. When a fixture is inserted directly, say why in a comment.
