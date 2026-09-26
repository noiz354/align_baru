# PERFORMANCE

Performance here is not about scale — it is about **predictability at the mosque entrance** and
**survivability over two hours of recording**. Budgets are stated as numbers, and each has a test or
a metric that can falsify it.

Requirements: NFR-PERF-001…010 · Observability: `OBSERVABILITY.md` · SLOs: `docs/operations/SLO.md`

---

## 1. Reference conditions (budgets are meaningless without them)

| Condition | Definition |
|---|---|
| Device A ("volunteer phone") | Mid-range Android, 4 GB RAM, Chrome current, 4G (10 Mbps down / 3 Mbps up, 60 ms RTT) |
| Device B ("old phone") | 4-year-old Android, 2 GB RAM, 3G-fast (1.6 Mbps down / 750 kbps up, 150 ms RTT, 2% loss) |
| Device C ("desktop") | 4-core laptop, Chrome/Firefox current, broadband 20 Mbps |
| Data shape L | Large event: 320 registrations, 500 arrivals, 3 entrances, 2-hour recording |
| Data shape XL | Busiest supported: 1,000 registrations, 1,500 arrivals, 6 entrances, 4-hour recording |
| Baseline | A warm server (no cold start), single web instance, Postgres on the same region |

## 2. Budgets

### 2.1 Discovery and reading

| # | Metric | Target | Condition | Requirement |
|---|---|---|---|---|
| P1 | Event list useful content visible (LCP-ish) | ≤ 2.5 s | Device B, 3G, cold cache | NFR-PERF-001 |
| P2 | Event list LCP | ≤ 1.8 s | Device A, 4G, warm cache | NFR-PERF-001 |
| P3 | Initial JS for participant routes | ≤ 1 MB gzipped; ≤ 250 KB on the event detail route before interaction | Device A | NFR-MOB-003 |
| P4 | Event detail TTFB | ≤ 400 ms p95 | server-side | NFR-PERF-001 |
| P5 | Search results first page | ≤ 700 ms p95 | Data shape L corpus | NFR-PERF-009 |
| P6 | Published transcript first screenful | ≤ 1.5 s; streaming for the rest | Device A | NFR-PERF-008 |

### 2.2 Registration

| # | Metric | Target | Condition | Requirement |
|---|---|---|---|---|
| P7 | Registration submit (server) | ≤ 800 ms p95 | Data shape L | NFR-PERF-007 |
| P8 | Registration submit (perceived) | ≤ 1.2 s p95 including network | Device A | NFR-PERF-007 |
| P9 | Result page with QR visible | ≤ 1.5 s | Device B | FR-REG-003 |
| P10 | Capacity decision under contention | ≤ 1.5 s p95 with 50 concurrent submissions for the last seats | load test | CONCURRENCY C1 |

### 2.3 Check-in (the primary budget)

| # | Metric | Target | Condition | Requirement |
|---|---|---|---|---|
| P11 | Token validation server-side | **≤ 300 ms p95**, ≤ 500 ms p99 | Data shape XL, 200 scans/min | NFR-PERF-002 |
| P12 | Scan → visible confirmation | ≤ 1 s p95 (Device A/4G), ≤ 2.5 s p95 (Device B/3G) | entrance conditions | NFR-PERF-003 |
| P13 | Per-device throughput | ≥ 20 check-ins/min sustained for 10 min | Device A | NFR-PERF-004 |
| P14 | Per-event throughput | ≥ 200 scans/min p95 ≤ 300 ms, with 6 devices | Data shape XL | NFR-PERF-004 |
| P15 | Queue handling | 500 arrivals in ≤ 15 min with 3 devices | end-to-end drill (`QA.md`) | Acceptance §17.1 |
| P16 | Failure response (invalid/wrong event) | ≤ 400 ms | local rejections must be instant | NFR-PERF-004 |
| P17 | Reconnect after brief network loss | scanning resumes ≤ 2 s after connectivity returns | Device A | FR-CHECKIN-016 |

### 2.4 Organizer surfaces

| # | Metric | Target | Condition | Requirement |
|---|---|---|---|---|
| P18 | Dashboard first contentful paint | ≤ 2 s | Device C, warm | NFR-PERF-006 |
| P19 | Attendance summary load | ≤ 1.5 s | Data shape XL | FR-ATTEND-003 |
| P20 | Participant list pagination | ≤ 700 ms per page | Data shape XL | FR-REG-008 |
| P21 | Transcript editor open | ≤ 2 s to first editable screen (with a 2-hour transcript) | Device C | FR-TRANSCRIPT-007 |
| P22 | Transcript save | ≤ 600 ms p95 (revision write) | 2,000-segment transcript | FR-TRANSCRIPT-009 |
| P23 | CSV export job | ≤ 60 s for 5,000 rows | Data shape XL | FR-ATTEND-005 |

### 2.5 Recording and media

| # | Metric | Target | Condition | Requirement |
|---|---|---|---|---|
| P24 | Recording start (press → capturing) | ≤ 1.5 s after permission | Device A | NFR-PERF-010 |
| P25 | 10 s chunk upload | completes within the chunk interval on Device B (3G); ≤ 2 s on Device A | NFR-PERF-005 |
| P26 | Upload backlog during a session | **never exceeds 20 chunks** (≈ 200 s) and never grows monotonically | telemetry `upload_backlog_chunks` | NFR-PERF-005 |
| P27 | Client memory during a 2-hour session | ≤ 3× chunk size (≈ 1.5 MB) + queue metadata | instrumentation | ADR-0008 |
| P28 | Assembly (2-hour session) | ≤ 3 min wall clock | worker, CPU-limited | FR-AUDIO-009 |
| P29 | Normalisation + derivative (2-hour session) | ≤ 6 min wall clock combined | worker | FR-AUDIO-010 |
| P30 | Audio playback start | ≤ 1.2 s to first byte; seeking ≤ 800 ms | Device A, presigned URL | FR-CONTENT-001 |
| P31 | Published page with player+transcript | LCP ≤ 2 s | Device A | NFR-PERF-001 |

### 2.6 Jobs and background processing

| # | Metric | Target | Notes |
|---|---|---|---|
| P32 | Job pickup latency | ≤ 5 s p95 from enqueue to start | pg-boss polling interval |
| P33 | Transcription job submission | ≤ 10 s to provider acceptance | ADR-0011 |
| P34 | Search indexing after publication | ≤ 60 s to searchable | content freshness |
| P35 | Notification dispatch (confirmation) | ≤ 60 s p95 from registration | user expectation |
| P36 | Retention run (monthly volume) | ≤ 30 min; batch-limited | RETENTION.md §7 |

### 2.7 Database and infrastructure

| # | Metric | Target |
|---|---|---|
| P37 | Primary query p95 (indexed) | ≤ 50 ms |
| P38 | Connection pool saturation | ≤ 70% at peak (with 50% headroom for bursts) |
| P39 | Object storage latency (first byte) | ≤ 300 ms p95 |
| P40 | Error rate (5xx) on check-in path | ≤ 0.1% monthly (SLO) |

## 3. Design decisions that make the budgets achievable

| Decision | Budget it serves |
|---|---|
| Check-in is one indexed lookup + one insert, no queue, no notification in the transaction (`ARCHITECTURE.md` §7.1) | P11, P13, P14 |
| Scanner pauses decoding per scan and auto-resumes; no server round trip for malformed payloads | P12, P16 |
| MediaRecorder timeslice + IndexedDB queue, never a full-file blob | P26, P27 |
| Chunk upload concurrency capped at 2 with backoff | P25, P26 (protects the mosque's uplink from self-inflicted congestion) |
| Server-side streaming assembly (no full-file buffering) | P28 |
| ffmpeg runs only in the worker, CPU-limited, so recording/scanning never competes | P12, P28, P29 |
| Participant pages are server-rendered with minimal client JS; heavy UI (editor, scanner) is route-split | P3, P21 |
| Transcript fetched in pages (segments windowed) rather than as one huge document | P21, P22 |
| Worked example of the recording math: 10 s Opus @32 kbps ≈ 40 KB/chunk, ≈ 28 MB per 2 h | P25, P26 storage sizing |

## 4. Measurement and enforcement

| Layer | Tool | Cadence |
|---|---|---|
| Server timing | OpenTelemetry histograms on the spans in `OBSERVABILITY.md` | continuous |
| Front-end | Web Vitals (LCP, INP, CLS) reported to the collector as measurements (no PII) | continuous |
| Check-in drill | Scripted load test at 3× P14 in CI-nightly + before each release touching the entrance | nightly/weekly |
| Recording rehearsal | Playwright + fake devices, 2-hour accelerated simulation measuring backlog and memory | weekly |
| Budget regression | A release is blocked if a budget regresses by >20% without an accompanying ADR/justification | per release |
| Field reality | `checkin_duration_ms`, `upload_backlog_chunks`, `chunk_gap_ms` per deployment | continuous, reviewed monthly |

## 5. Anti-goals

1. **No premature scaling work.** We do not shard, cache aggressively or add services for load we
   do not have; the measured ceiling of the chosen stack is far above the target deployment size
   (`docs/research/STACK-2026.md`).
2. **No performance that trades truthfulness.** We never optimistically show a check-in as
   successful, never pre-render attendance counts that may be wrong, and never skip signature/
   policy checks on media for speed.
3. **No optimisation by hiding.** If a page is slow, the number moves or the architecture changes —
   spinners that appear to be progress are not a fix.
4. **No engagement-driven performance choices** (e.g. autoplay, prefetching unrelated content).
