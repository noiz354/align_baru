# StrangerLink — Retention

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-013](docs/adr/ADR-013-retention-policy.md), [PRIVACY.md](PRIVACY.md), [DATA_MODEL.md](DATA_MODEL.md)

---

## 0. Position

**We do not silently retain random conversations indefinitely.** We do not retain them at
all.

The default for every data class in this product is **the shortest period that still lets
us do the safety job**. Lengthening a retention period requires a written justification
reviewed by Trust & Safety and Legal. Shortening one is always available.

---

## 1. Tiers

| Tier | Data class | Retention | Rationale |
| --- | --- | --- | --- |
| **0** | Chat message content, media, SDP bodies, ICE candidate strings | **Not stored** | The single largest privacy risk available to this product. Storing strangers' conversations buys us very little |
| **1** | Queue entries, connection registries, active session records | Process lifetime | Ephemeral by nature; a durable queue table would be a durable record of who was looking for a stranger |
| **2** | Session metadata (`ChatSession`, `SessionInterest`) | **30 days** | Covers the bounded post-session reporting window plus investigation time. Not a durable social graph |
| **3** | Reports, safety events | **12 months** | Repeat-offender detection and appeals |
| **4** | Bans, moderation actions, audit events | **24 months** | Enforcement integrity and non-repudiation. Indefinite bans are reviewed on a schedule |
| **5** | Telemetry, traces, metrics | **13 months** | Operational trend analysis; contains no identities |
| **6** | IP-derived risk signals (hashed) | **7 days rolling** | Only as long as needed for rate limiting and cooldowns |
| **7** | coturn logs | **Shortest workable** (target ≤ 7 days) | coturn necessarily sees relay metadata; it must not become an archive |

---

## 2. Per-class detail

### 2.1 Chat content — Tier 0

| Property | Value |
| --- | --- |
| Stored | **No** |
| In memory | Session lifetime only |
| On session end | Dropped |
| Backup exposure | None — never written to durable storage |
| Moderator access | None — nothing exists |

**Why:** storing random strangers' conversations creates a database that is a target for
breach, subpoena, and misuse, and it contradicts the product's core promise. The cost is
that moderators usually cannot reconstruct a conversation. Accepted and disclosed.

**Control:** a scheduled test asserts that no table in the schema has a message-content
column. Adding one requires a new ADR and a privacy impact assessment (ADR-002 MR-3).

### 2.2 Session metadata — Tier 2, 30 days

| Field | Retention |
| --- | --- |
| `id`, `participantAId`, `participantBId` | 30 days |
| `mode` | 30 days |
| `status`, `createdAt`, `endedAt`, `endReason`, `durationMs` | 30 days |
| `SessionInterest` rows | 30 days |

**Justification for 30 days:** a report may be submitted for a bounded window after a
session ends (ADR-011), and investigating a report needs the session to exist. Thirty days
covers the reporting window plus triage time. It is not long enough to be a useful social
graph.

**What is deliberately not retained:** any message reference, any transcript pointer, any
media reference.

### 2.3 Reports — Tier 3, 12 months

| Field | Retention |
| --- | --- |
| `category`, `severity` | 12 months |
| `note` | 12 months |
| `sessionId`, reporter and peer identities | 12 months |
| `dedupKey`, `status` | 12 months |

**Justification:** repeat-offender detection needs a year of history to be meaningful, and
appeals can arrive months later. Twelve months is the shortest period that supports both.

### 2.4 Moderation actions and audit — Tier 4, 24 months

| Field | Retention |
| --- | --- |
| `ModerationAction` (actor, action, reason, target, policy version) | 24 months |
| `AuditEvent` (append-only) | 24 months |

**Justification:** non-repudiation and the ability to reconstruct what the policy said when
an action was taken. Twenty-four months covers an appeal cycle plus a review cycle.

### 2.5 Bans — Tier 4, 24 months with mandatory review

| Property | Value |
| --- | --- |
| Bounded bans | Deleted at `expiresAt` + 24 months |
| Indefinite bans | **Reviewed on a schedule** (monthly); each review is audited |
| Ban record contents | Subject type/id, reason code, severity, source, creator, timestamps, appeal status, policy version |
| Ban record excludes | Name, email, phone, raw IP, device fingerprint |

### 2.6 IP / risk data — Tier 6, 7 days rolling

| Property | Value |
| --- | --- |
| Raw IP | **Never retained.** Used transiently for connection security |
| Hashed coarse signal | 7 days rolling |
| Permitted use | Rate limiting and cooldowns **only** — never a standalone ban (ADR-012 MR-2) |
| Not used for | Analytics, enforcement beyond rate limits, sharing |

### 2.7 Telemetry — Tier 5, 13 months

| Property | Value |
| --- | --- |
| Contents | Traces and metrics; identifiers and durations, never content |
| Access | Separately access-controlled from application data |
| Retention | 13 months |
| Not present | Message content, report notes, IP addresses, device identifiers |

### 2.8 TURN logs — Tier 7

| Property | Value |
| --- | --- |
| Contents | Allocation and session metadata; **never media content** (it cannot contain it) |
| Verbose logging | **Disabled in production** |
| Access | Restricted, separate stream |
| Retention | Shortest workable; target ≤ 7 days |

---

## 3. Enforcement

### 3.1 The retention job

| Property | Commitment |
| --- | --- |
| Schedule | Daily |
| Idempotent | Yes — safe to re-run |
| Logged | Every run records rows deleted per tier |
| **Alerts on failure** | Yes — a failed run is a **privacy incident**, not a background error |
| Runbook | [RUNBOOK.md](RUNBOOK.md) |

### 3.2 Verification

A scheduled test asserts:

1. A `ChatSession` row older than 30 days does not exist.
2. A `Report` older than 12 months does not exist.
3. An `AuditEvent` older than 24 months does not exist.
4. No message-content column exists anywhere in the schema.
5. `riskSignalHash` older than 7 days does not exist.

### 3.3 Backups

| Property | Commitment |
| --- | --- |
| Backup retention | Must not exceed the longest tier (24 months) plus a short operational margin |
| Deletion propagation | Deletions propagate to backups on the backup rotation schedule |
| Disclosure | Backup retention is stated in the privacy notice |

### 3.4 Deletion on request

| Request | Handling |
| --- | --- |
| Session metadata | Deleted on request if within the window |
| Reports | Deleted within legal limits; the decision and basis recorded |
| Bans / audit | May be legally required to persist; honoured to the extent the law allows, and the requester is told |
| Chat / media | Nothing to delete |

---

## 4. Retention decision record

| Tier | Period | Decided by | Reviewed |
| --- | --- | --- | --- |
| 0 | Not stored | Architecture + Trust & Safety | Quarterly |
| 1 | Process lifetime | Architecture | Quarterly |
| 2 | 30 days | Trust & Safety + Privacy | Quarterly |
| 3 | 12 months | Trust & Safety + Privacy | Quarterly |
| 4 | 24 months | Trust & Safety + Legal | Quarterly |
| 5 | 13 months | SRE + Privacy | Quarterly |
| 6 | 7 days | Privacy + Trust & Safety | Quarterly |
| 7 | ≤ 7 days | SRE + Privacy | Quarterly |

---

## 5. What we will not do

| Not done | Why |
| --- | --- |
| Retain chat content "just in case" | The largest privacy risk available; minimal safety benefit |
| Retain indefinitely because deletion is hard | Deletion is a feature, not a chore |
| Extend retention without a written justification | The default is the shortest workable period |
| Keep data "for future ML" | Speculative retention is still retention |
| Retain raw IP addresses | Only a coarse, short-lived hash is ever held |
| Retain media | No recording path exists |
| Quietly extend a tier in a routine change | Any change requires the review in §4 |

---

## 6. Implementation status

The retention job is **not implemented**. It is tracked as **T-RET-131** in
[TASKS.md](TASKS.md) and is scheduled for VS-15 (Production Hardening), because a
retention job that runs before there is data to retain is untestable.
