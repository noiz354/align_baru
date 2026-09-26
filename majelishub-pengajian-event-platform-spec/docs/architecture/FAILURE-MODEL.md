# FAILURE MODEL

Requirements: NFR-REL-001…006 · Related: `docs/architecture/CONCURRENCY.md`, `RUNBOOK.md`,
`docs/operations/SLO.md`, `DEPLOYMENT.md` §10

---

## 1. Ranking of consequences (drives every trade-off)

| Rank | Consequence | Why it is worst |
|---|---|---|
| 1 | **Attendance is wrong** (missing or duplicate) | A mosque cannot reconstruct who came; trust in the whole record collapses |
| 2 | **Audio lost** | Irreplaceable content; cannot be re-recorded |
| 3 | **Machine text published unreviewed** | Misquoting a speaker or a revelation is not fixable by an announcement |
| 4 | **Personal data exposed** | Harms people who trusted a mosque |
| 5 | **Entrance slows or stops** | Visible, embarrassing, but recoverable with paper |
| 6 | **Feature unavailable** (dashboard, feedback, archive) | Annoying; no permanent harm |
| 7 | **Telemetry lost** | Diagnosability suffers; the product continues |

Rule: never trade a rank-1 or rank-2 outcome for a rank-6 or rank-7 benefit (e.g. do not skip the
storage durability confirmation to make the upload feel faster).

## 2. Failure modes, detection and behaviour

| Component | Failure | Detection | Product behaviour | Recovery |
|---|---|---|---|---|
| App container | Crash / OOM | Health probe, 5xx rate | Rolling restart behind the proxy; in-flight requests fail cleanly; no data loss (writes are transactional) | Automatic |
| Database | Unavailable | Health probe, query errors | Mutations fail with a distinct `UNAVAILABLE`; **no false success**; read-only pages may serve from cache where safe | Failover/restore (RB-08) |
| Database | Connection pool exhausted | `db_pool_saturation` | Requests queue briefly then shed with `SERVER_BUSY`; check-in degrades to manual | Restart app / fix leak |
| Database | Long lock / slow query | Query duration metric | Statement timeout aborts the query with a clean error | Investigate query plan |
| Storage | Unavailable / quota | Storage error metric | Uploads fail closed, client keeps queue; assembly/processing pause; nothing half-written | RB-07 |
| Media worker | Crash mid-job | Job lease expiry | Job re-claimed by another worker; idempotent per attempt key | Automatic |
| Media worker | ffmpeg missing/blocked | Worker health check | No jobs claimed; alert; sessions stay `UPLOADED` (nothing lost) | Fix image |
| Job queue | Backlog | `JOB_BACKLOG_HIGH` | Non-urgent work slows; the product still functions (uploads and check-in are independent) | Add worker capacity |
| Job queue | Poison job | Repeated failure → dead letter | Declared dead with the reason; operator queue visible | Inspect, fix, replay deliberately |
| Provider (STT) | Outage | Failure ratio | Job fails with a truthful state; audio unaffected; organizer informed | Retry / switch provider by configuration |
| Provider (email) | Outage | Failure ratio + dead letters | Intent recorded, message not sent; in-app channel still works | Retry, then manual communication (RB-11) |
| Proxy | TLS/HTTP failure | Availability probe | Total outage; the manual paper path covers the entrance | RB-16 |
| Client device | Battery/thermal/crash | Missing chunks | Gap manifest + honest summary; the recording is partial, never mislabelled | Re-record if possible |
| Client network | Venue Wi-Fi loss | Backlog metric | Queue grows locally; UI says "belum terkirim" | Flush when connectivity returns |
| Clock | Skew across hosts | Window/latency anomalies | Server clock is authoritative for all decisions; worker clocks are never used for ordering | NTP correction |
| Search index | Stale | Published item not findable | **Fail closed**: an item missing from search is acceptable; an unpublish that remains findable is not | Reindex |
| Audit | Write failure | Error on audited action | Security-relevant actions fail closed; the action is retried or refused with an explanation | Investigate immediately |
| Retention | Job failure | `retention_failures_total` | Data stays longer than the policy (a compliance issue, not a data-integrity one); alert + review | RB-12 |
| Backup | Silent failure | `backup-verify` | Declared an incident; restore drill reveals the truth | Restore from the previous good backup |

## 3. Degraded modes (deliberate, documented, visible)

| Mode | Trigger | What still works | What is stated to users |
|---|---|---|---|
| Manual-only check-in | DB/db-pool/scan failures | Manual entry, walk-ins, paper fallback | Console banner + runbook RB-01 |
| Recording-local-only | Storage/upload outage | Recording continues, queue grows | Recorder banner "belum terkirim" |
| Transcription paused | Provider/egress disabled | Audio, archive, attendance | "Transkripsi ditunda" with the reason category |
| Notifications paused | Provider outage | Everything in-app | Organizer notice, intents retained |
| Read-only archive | Database write failures | Published content browsing (cached where safe) | Neutral banner |
| Maintenance | Deployment/migration | A calm maintenance page; no writes | "Sedang dalam pemeliharaan" |

Modes are entered by flag, changed by a human, audited, and shown on the affected screen. Entering a
degraded mode must never silently weaken a security or privacy control.

## 4. Retry and timeout policy (defaults, per component)

| Operation | Timeout | Retries | Backoff | Idempotent? |
|---|---|---|---|---|
| HTTP API request | 10 s | 0 (client decides) | — | Mutations: yes (Idempotency-Key) |
| Chunk upload | 30 s | client: unlimited with backoff | 1→30 s + jitter | Yes (sequence+hash) |
| Assembly/processing job | 4× audio duration | 3 | 30 s ×2 | Yes (attempt key) |
| Transcription submit/poll/fetch | 60 s | 3 | 30 s ×2 | Yes (providerJobId, event) |
| Notification dispatch | 15 s | 5 | 10 s ×2 | Yes (dedupe key) |
| Retention batch | 15 min per batch | 2 | 5 min | Yes (re-run safe) |
| Storage operations | 30 s | 3 | 200 ms ×2 | GET/PUT yes; DELETE idempotent |

Timeout ≠ success. A timeout on a mutating call must be resolved by **reconciling state** (idempotency
key lookup / `acceptedUpTo`), never by assuming the write happened or by writing again blindly. This is
the single most common source of duplicate records in systems like this.

## 5. Testing the model

| Failure | Test |
|---|---|
| DB unavailable during check-in | `tests/integration/ops/degraded-mode.test.ts` + QA-06 drill |
| Storage unavailable during recording | E2E scenario 3 (interrupted upload) |
| Worker restart mid-assembly | `tests/integration/jobs/duplicate-execution.test.ts` (C11) |
| Provider outage | Adapter contract tests with failure fixtures + QA-06 drill |
| Restore safety | `tests/integration/ops/restore-safety.test.ts` |
| Poison job | Dead-letter test with a deliberately throwing handler |
| Search staleness | Index test asserting unpublished items are never returned (fail-closed assertion) |
