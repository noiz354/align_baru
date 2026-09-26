# StrangerLink — Performance

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [OBSERVABILITY.md](OBSERVABILITY.md), [docs/realtime/FAILURE-MODEL.md](docs/realtime/FAILURE-MODEL.md), [ACCESSIBILITY.md](ACCESSIBILITY.md)

---

## 0. Position

Budgets are stated as **targets with measurement**, not promises. We do not promise
zero-latency matching — matching two strangers is a queueing problem and queueing problems
have tails. What we do promise is that the *common case* is fast, that the *tail* is
bounded, and that the user is never left without information about what is happening.

Every budget below has an associated metric and an alert threshold.

---

## 1. Latency budgets

| ID | Operation | p50 | p95 | p99 | Notes |
| --- | --- | --- | --- | --- | --- |
| PB-1 | Landing page first contentful paint | < 1.0 s | < 2.0 s | < 3.0 s | 4G, mid-range Android |
| PB-2 | Landing page largest contentful paint | < 1.5 s | < 2.5 s | < 4.0 s | — |
| PB-3 | Queue join → server acknowledgement | < 100 ms | < 300 ms | < 600 ms | FR-QUEUE-003, NFR-PERF-002 |
| PB-4 | Queue join → matched | < 2 s | < 10 s | < 30 s | **Highly load-dependent.** The p99 is bounded by the queue timeout |
| PB-5 | Signaling message round trip | < 50 ms | < 200 ms | < 500 ms | Same-region |
| PB-6 | Text message end-to-end delivery | < 150 ms | < 500 ms | < 1 s | NFR-PERF-003 |
| PB-7 | WebRTC connection establishment | < 1.5 s | < 5 s | < 10 s | NFR-PERF-004, typical 4G |
| PB-8 | TURN fallback establishment | < 2.5 s | < 7 s | < 12 s | Adds relay path |
| PB-9 | Report submission → acknowledgement | < 200 ms | < 600 ms | < 1.5 s | Safety-critical |
| PB-10 | Block creation → acknowledgement | < 150 ms | < 500 ms | < 1 s | Safety-critical |
| PB-11 | Route transition (client-side) | < 100 ms | < 300 ms | < 600 ms | — |
| PB-12 | ICE restart | < 1 s | < 3 s | < 6 s | — |

### On PB-4 honestly

Match latency is a **queueing** metric, not an engineering metric. Under load, or with
narrow interests, it will exceed every number above. We do not pretend otherwise:

- The queue wait is **bounded** by the queue timeout (see §2).
- The user always sees elapsed wait time.
- The user is never told "almost there" — we do not fabricate progress.
- After the timeout, the user gets an explicit choice, not an automatic retry.

---

## 2. Timeouts and bounds

| Bound | Value | Rationale |
| --- | --- | --- |
| Queue wait timeout | 120 s | Bounded exposure to a spinner; beyond this, offer retry or exit |
| Interest preference window | 15 s | After this, fall back to the general pool (ADR-009) |
| Reconnect window | 15 s | Long enough for a network switch; short enough to not strand the user |
| WebRTC setup timeout | 15 s | Then `FAILED` with a specific reason |
| ICE gathering timeout | 5 s | Then proceed with what we have |
| Session duration | 30 min | FR-SAFE-003 |
| Idle session (no messages) | 10 min | Then offer to continue or end |
| TURN credential lifetime | 5 min | ADR-006 |
| TURN allocation idle timeout | 10 min | Reaped by coturn |

---

## 3. Client resource budgets

| ID | Resource | Budget | Measurement |
| --- | --- | --- | --- |
| CB-1 | Initial JS (landing) | ≤ 120 KB gzipped | Bundle analysis in CI |
| CB-2 | Initial JS (chat route) | ≤ 180 KB gzipped | Route-level budget |
| CB-3 | Initial CSS | ≤ 30 KB gzipped | Bundle analysis |
| CB-4 | Total JS (chat route, all chunks) | ≤ 300 KB gzipped | Bundle analysis |
| CB-5 | Initial JS (media mode, lazy) | ≤ 60 KB gzipped additional | Media code is lazily loaded |
| CB-6 | Memory, 60-minute session | ≤ 120 MB growth | Heap snapshot test |
| CB-7 | Memory, 60-minute video session | ≤ 250 MB growth | Heap snapshot test |
| CB-8 | CPU, idle chat | ≤ 5% of one core | Profiling on a mid-range device |
| CB-9 | CPU, active video | ≤ 35% of one core | Profiling on a mid-range device |
| CB-10 | Battery, 30-minute video | Within 8% of device battery | Device lab |
| CB-11 | Layout shift (CLS) | < 0.1 | Lighthouse |
| CB-12 | First input delay | < 100 ms | Field data |

**The media bundle is lazy-loaded.** A text-only user never downloads WebRTC code. This is
both a performance and a privacy property: the client does not even have the code to
request a camera until the user chooses a media mode.

---

## 4. Network budgets

| ID | Metric | Budget |
| --- | --- | --- |
| NB-1 | Signaling bandwidth per session | < 100 KB total |
| NB-2 | Chat bandwidth per session | < 20 KB |
| NB-3 | Audio bitrate | 24–40 kbps (Opus) |
| NB-4 | Video bitrate (send) | ≤ 1.2 Mbps |
| NB-5 | Video bitrate (receive) | ≤ 1.5 Mbps |
| NB-6 | Video resolution (send) | ≤ 640 × 480 default; upscale only on capable networks |
| NB-7 | TURN relay bandwidth per video session | ≤ 2.5 Mbps sustained |
| NB-8 | Requests per page load | ≤ 12 |

**Bitrate caps are deliberate.** A stranger chat does not need HD, and uncapped video is
how TURN costs explode (T-06).

---

## 5. Server budgets

| ID | Metric | Budget |
| --- | --- | --- |
| SB-1 | Web service p95 response | < 200 ms |
| SB-2 | Realtime service CPU per 1,000 connections | < 40% of one core |
| SB-3 | Realtime memory per 1,000 connections | < 300 MB |
| SB-4 | PostgreSQL connections (pooled) | ≤ 80% of the configured maximum |
| SB-5 | Matchmaking candidate scan | < 1 ms typical; bounded scan window |
| SB-6 | Report write | < 50 ms |
| SB-7 | Ban check | < 5 ms (indexed point lookup) |

---

## 6. Capacity model

| Dimension | Target | Notes |
| --- | --- | --- |
| Concurrent waiting participants | 5,000 per realtime instance | Load-tested before VS-15 |
| Concurrent active sessions | 10,000 per realtime instance | — |
| New matches per second | 200 per instance | — |
| Reports per second | 20 sustained | — |
| TURN concurrent allocations | 2,000 per coturn node | Cost-driven |

**These are targets to be validated by load testing, not claims.** See
[TESTING.md](TESTING.md).

---

## 7. Load and stress testing

| Test | Goal | Phase |
| --- | --- | --- |
| WebSocket connection ramp | Validate SB-2, SB-3 | VS-15 |
| Match throughput | Validate the match rate target | VS-15 |
| Message flood | Validate T-08 mitigations hold | VS-13 |
| Queue join/leave storm | Validate race handling under load | VS-3 |
| TURN saturation | Validate T-06 quotas and alerting | VS-11 |
| Report flood | Validate T-25 mitigations | VS-12 |
| Realtime restart under load | Validate graceful drain | VS-15 |

Tool selection is deferred to the load-testing task; the **requirement** is recorded now.

---

## 8. Performance and safety interaction

Budgets are never allowed to weaken safety:

| Temptation | Our position |
| --- | --- |
| Skip the ban check to save 5 ms | **Never.** Ban checks fail closed |
| Raise the message rate limit to reduce perceived latency | **No.** The limit is a safety control |
| Reduce the session duration cap to save resources | The cap is already a safety control |
| Cache eligibility snapshots to speed matching | **No.** Eligibility is evaluated at selection time (ADR-008 MR-3) |
| Lower WebRTC quality to save bandwidth | Only within the NB-4/NB-5 caps, which are already conservative |
| Skip telemetry under load | Safety spans are always sampled |

---

## 9. Measurement

| Budget | Metric | Dashboard | Alert |
| --- | --- | --- | --- |
| PB-3 | `queue.join.latency` | Realtime | p95 breach |
| PB-4 | `matchmaking.latency` | Realtime | p95 breach |
| PB-6 | `chat.message.latency` | Realtime | p95 breach |
| PB-7/PB-8 | `webrtc.setup.duration` | Realtime | p95 breach |
| CB-1…CB-5 | Bundle size | CI | Budget exceeded |
| CB-6/CB-7 | Heap growth | CI (synthetic session) | Budget exceeded |
| SB-2/SB-3 | Connection resource usage | Platform | Threshold breach |
| SB-4 | Pool saturation | Platform | Threshold breach |

---

## 10. What we do not promise

| Not promised | Why |
| --- | --- |
| Zero-latency matching | Matching is queueing; it has tails |
| Instant matching under load | Capacity is finite |
| 1080p video | Bitrate and cost |
| Sub-100ms media on all networks | Physics and NAT |
| Guaranteed video for every user | Some networks block relay |
| A fixed match time | Load-dependent |

---

## 11. Implementation status

No performance instrumentation exists. Metric definitions are specified in
[OBSERVABILITY.md](OBSERVABILITY.md) and tracked as **T-OBS-111** in [TASKS.md](TASKS.md).
