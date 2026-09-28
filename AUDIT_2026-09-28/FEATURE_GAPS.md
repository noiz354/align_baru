# FEATURE GAPS

Priority is about the *user*, not the architecture.

| | |
|---|---|
| **P0** | security, data loss, identity, or tenant-isolation defect that makes normal use unsafe |
| **P1** | a core user journey cannot complete |
| **P2** | the core journey works but is operationally incomplete |
| **P3** | quality, convenience, enhancement |

Architectural purity is not a P0/P1 unless it affects security, correctness, reliability, or the
ability to deliver the feature. A missing lint rule is not a P1. A header that authenticates a caller
is.

---

## GAP-P0 — safety blockers (must clear before anything else ships)

| ID | Project | Gap | Why P0 |
|---|---|---|---|
| GAP-P0-SIO-01 | siomayops | Fake auth returns `HQ_OPS` in production; unauthenticated `POST` returns `201` | Anyone on the internet can create business records and read the audit log |
| GAP-P0-HOM-01 | homeops | Tenant identity from `?householdId=`; any household's data served to anyone | Cross-household disclosure of private home data |
| GAP-P0-HOM-02 | homeops | Zero RLS on 17 tables | The stated primary boundary does not exist in any layer |
| GAP-P0-HOM-03 | homeops | `0001_rooms_chores.sql` not in the drizzle journal; deploy reports success and 500s | The deploy pipeline is silently broken |
| GAP-P0-MAJ-01 | majelishub | `x-majelishub-user` authenticates the caller on 3 handlers | Impersonation with a guessable id |
| GAP-P0-MAJ-02 | majelishub | 4 public pages read tenant data unscoped and unfiltered | Leaks in dev, silently empty in production |
| GAP-P0-MAJ-03 | majelishub | `catch → []` renders a DB error as "0 results" | Trust destruction; forbidden by the project's own rules |
| GAP-P0-MAJ-06 | majelishub | Duplicate registration returns another attendee's short code | Check-in capability disclosure |
| GAP-P0-MAJ-04 | majelishub | `event_registrations` / `event_attendance` have no RLS | Contract stated in the migration is not enforced |
| GAP-P0-MAN-01 | manga | `/admin/**` unauthenticated | Boundary must exist before the first admin write lands |

**Ordering within P0:** the P0s are grouped into four independent units so four agents can work in
parallel. See [`specs/execution/OWNERSHIP.md`](../specs/execution/OWNERSHIP.md).

- Unit A — siomayops: `F-001`
- Unit B — homeops: `F-002`, `F-003`, `F-004`
- Unit C — majelishub: `F-005`, `F-006`, `F-007`
- Unit D — manga: `F-008`

---

## GAP-P1 — core journeys cannot complete

| ID | Project | Gap | The journey that is blocked |
|---|---|---|---|
| GAP-P1-SIO-01 | siomayops | No real session provider | UJ-SIO-001…006 all |
| GAP-P1-SIO-02 | siomayops | `Idempotency-Key` optional on money routes | UJ-SIO-002 (double charge on retry) |
| GAP-P1-SIO-03 | siomayops | No database: all state in memory, `withTransaction` is `fn({})` | every journey dies on restart |
| GAP-P1-HOM-05 | homeops | Sign-in pages exist but no route resolves a session | UJ-HOM-001…005 |
| GAP-P1-HOM-06 | homeops | `authorize.ts` unimplemented, 0 callers | every mutating journey |
| GAP-P1-HOM-07 | homeops | Integration suite skipped, not failed | CI proves nothing |
| GAP-P1-MAJ-08 | majelishub | Registration and check-in have **no tests at all** | UJ-MAJ-005, UJ-MAJ-006 |
| GAP-P1-MAJ-09 | majelishub | Test harness has no schema-per-suite isolation; the integration project cannot run as a batch on real PG | every "verified on PostgreSQL 18" claim |
| GAP-P1-MAJ-10 | majelishub | `audit/coverage.test.ts` fails on real PG (int-as-string driver divergence) | audit-chain correctness evidence |
| GAP-P1-MAJ-11 | majelishub | No `verify:vs0` script despite being documented as a gate | the project's own quality gate is unreachable |
| GAP-P1-MAN-02 | manga | Progress suite never executes (two runners declared, one unused) | UJ-MAN-003 evidence |
| GAP-P1-SLK-01 | strangerlink | Safety records (bans, reports, cases) are in-memory | UJ-SLK-004 |
| GAP-P1-SLK-02 | strangerlink | `eslint` not installed; CI disabled lint for 6 projects | every project's static gate |
| GAP-P1-PRK-01 | parking | No operator UI; `server.py` was never committed | UJ-PRK-001…004 all |

---

## GAP-P2 — the journey works, operationally incomplete

| ID | Project | Gap |
|---|---|---|
| GAP-P2-SIO-01 | siomayops | No `package-lock.json` — installs are not reproducible |
| GAP-P2-SIO-02 | siomayops | `tests/e2e/*.spec.ts` never navigate the app; `test:e2e` is advertised anyway |
| GAP-P2-SIO-03 | siomayops | No deployment pipeline, no migration run, no schema-version check |
| GAP-P2-HOM-01 | homeops | Design system unimplemented; every page uses inline `style={{}}`; no contrast evidence |
| GAP-P2-HOM-02 | homeops | 30 lint errors from the project's own `homeops/boundaries` rule, never run in CI |
| GAP-P2-HOM-03 | homeops | No seed for a fresh environment; the demo seed writes tables with raw SQL, hiding GAP-P0-HOM-03 |
| GAP-P2-MAJ-01 | majelishub | 44 of 49 pages are `ROUTE SHELL`; audio, transcription, notifications, feedback all absent |
| GAP-P2-MAJ-02 | majelishub | No device binding for the entrance volunteer session (`T-CHECKIN-016`) |
| GAP-P2-MAJ-03 | majelishub | No rate limit on public registration (`T-REG-009`) |
| GAP-P2-MAJ-04 | majelishub | `createEvent` does not verify the mosque belongs to the caller's organization |
| GAP-P2-SLK-01 | strangerlink | Realtime server is a separate process; the primary README never mentions it |
| GAP-P2-SLK-02 | strangerlink | No TURN; WebRTC proven only with native synthetic audio |
| GAP-P2-SLK-03 | strangerlink | 20 `test.todo` remain; no e2e harness |
| GAP-P2-MAN-01 | manga | No PostgreSQL: users, sessions and progress are in-memory / local JSON; no cross-device resume |
| GAP-P2-MAN-02 | manga | No upload pipeline, no image processing, no moderation |
| GAP-P2-MAN-03 | manga | No lint script at all |
| GAP-P2-PRK-01 | parking | `IOcrEngine` is an abstract port; `MockEdgeOcrEngine` is test-only |
| GAP-P2-PRK-02 | parking | `VehicleWatchlistService.check_watchlist` returns `None` for every input, while `VEHICLE.md §4` states watchlist policy as if in force |
| GAP-P2-PRK-03 | parking | `TASK-nnn` id format excludes it from every workspace-wide task count and lint rule |
| GAP-P2-RSI-01 | rsi | `DELIVERABLES.md` P-07 is stale — `tests/test_artifacts.py` now exists |

---

## GAP-P3 — quality and convenience

| ID | Project | Gap |
|---|---|---|
| GAP-P3-SIO-01 | siomayops | `check:stubs` and `census` are the project's own gates and both exit 1; neither runs in CI |
| GAP-P3-SIO-02 | siomayops | OTel is declared and configured but no dashboard or alert is wired |
| GAP-P3-HOM-01 | homeops | `scripts/check-contrast.mjs` exists but has never gated a page |
| GAP-P3-MAJ-01 | majelishub | `verify-vs0.mjs` exists and is never invoked; its criteria 4 and 6 would fail today |
| GAP-P3-MAJ-02 | majelishub | 281 `test.todo` and 78 `describe.todo` read as progress in any count-based report |
| GAP-P3-SLK-01 | strangerlink | No admin moderation UI behind the existing authorization layer |
| GAP-P3-MAN-01 | manga | E2E suite written but never executed in any environment |
| GAP-P3-ROOT-01 | workspace | Root `AGENTS.md` status table is pre-wave-2 for six of eight projects |
| GAP-P3-ROOT-02 | workspace | `COMPLETION_MATRIX.md` quotes 715 task ids (actual 514) and 755 tests (no single run produces it) |
| GAP-P3-ROOT-03 | workspace | `scripts/check-claims.mjs` passes, but only checks package presence and file landmarks — not status or numbers |
| GAP-P3-ROOT-04 | workspace | Root `README.md` is one line |
| GAP-P3-ROOT-05 | workspace | `MVP_AUDIT/screenshots/` and `wave3/…/RUNTIME_PROOF.md` disagree on whether browser screenshots exist |

---

## Feature inflation explicitly rejected

The following were considered and **rejected**, because no concrete user problem is solved by them and
each would add surface that the P0s make unsafe:

- Audio upload, media processing, and the S3/minio stack in majelishub — the primary flow
  (discover → register → check in) is blocked; recording is VS-4+ by the project's own roadmap.
- Transcript review, publication, and the human-in-the-loop workflow — nothing to review until audio
  exists.
- Notification delivery, push, email in any project — no core journey reaches the point of needing it.
- Leaderboards, "popularity" ordering, and any engagement metric in majelishub — explicitly forbidden
  by ADR-0014/ADR-0024 and contrary to the product's own ethos.
- Heatmaps, overstay alerting, and multi-site scale in parking — the operator UI does not exist yet.
- Search, recommendations, and "smart" features in manga — the catalog is three titles.
- Payment-provider adapters, loyalty maths beyond the existing implementation, in siomayops — the
  current refusal to settle QRIS is correct; an adapter without credentials would be a fake.
- A live LLM provider for rsi — out of declared scope, and `DELIVERABLES.md` says so correctly.
