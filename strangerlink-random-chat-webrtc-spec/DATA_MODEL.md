# StrangerLink — Data Model

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DOMAIN.md](DOMAIN.md), [RETENTION.md](RETENTION.md), [ADR-002](docs/adr/ADR-002-database.md), [ADR-013](docs/adr/ADR-013-retention-policy.md)

> **No migrations exist in this repository.** This document describes the intended shape of
> durable state. Implementations are repository ports in [src/server/db/](src/server/db/)
> and throw `Not implemented`.

---

## 1. State placement philosophy

The single most important data decision in this product is **what is not stored**.

| Stored? | Data | Reason |
| --- | --- | --- |
| **Never** | Chat message content | Privacy and harm minimisation; ADR-013 Tier 0 |
| **Never** | Media (audio/video) | No recording path exists (FR-MEDIA-008) |
| **Never** | SDP bodies, ICE candidate strings | Ephemeral signaling artifacts |
| **Never** | TURN credentials | Computed on demand, minutes-long lifetime |
| **Never** | Names, emails, phone numbers | No accounts; NFR-PRIV-001 |
| **Ephemeral** | Queue entries, connection registry | Die with the process |
| **Durable** | Session metadata, reports, blocks, bans, moderation actions, audit, safety events | Safety utility |

---

## 2. Where state lives

| Store | Holds | Rationale |
| --- | --- | --- |
| **PostgreSQL 18** | All durable safety records | Integrity, transactions, retention jobs |
| **Realtime service memory** | Queue, connection registry, active sessions | Hot path, ephemeral, must not become a durable record of who talked to whom |
| **Browser (sessionStorage)** | Age/consent attestation, block list, participant identity | No server-side profile; dies with the tab |
| **Nowhere** | Chat content, media, SDP, ICE, TURN credentials | See above |
| **Redis** | *Nothing yet.* Conditional on multi-instance realtime (ADR-002) | Deferred |

---

## 3. Entities

### 3.1 `Participant`

A pseudonymous session identity.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | Server-generated |
| `status` | `ParticipantStatus` | `ACTIVE` \| `RESTRICTED` \| `BANNED` |
| `createdAt` | `timestamptz` | — |
| `lastSeenAt` | `timestamptz` | Used for cooldown windows |

**Deliberately absent:** name, email, phone, avatar, locale preference beyond matching,
any account linkage.

### 3.2 `SessionIdentity`

The identity a participant presents within a session, plus risk signals used for abuse
prevention.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `participantId` | `uuid` | FK |
| `riskSignalHash` | `bytea \| null` | Hashed IP-derived signal; **not** an IP address |
| `createdAt` | `timestamptz` | — |

**Note on `riskSignalHash`:** this is a one-way hash of a coarse, IP-derived signal. It is
**not** a device fingerprint (see [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md)) and it can
only ever trigger rate limits and cooldowns, never a standalone ban (ADR-012 MR-2).

### 3.3 `ChatSession`

Session metadata — **not content**.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | Unguessable; server-generated only (INV-7) |
| `participantAId` | `uuid` | FK → Participant |
| `participantBId` | `uuid` | FK → Participant |
| `mode` | `ChatMode` | `TEXT` \| `TEXT_AUDIO` \| `TEXT_VIDEO` |
| `status` | `SessionStatus` | See [STATE_MACHINE.md](STATE_MACHINE.md) |
| `createdAt` | `timestamptz` | — |
| `endedAt` | `timestamptz \| null` | — |
| `endReason` | `SessionEndReason \| null` | Enum; no free text |
| `durationMs` | `int \| null` | Derived |

**Deliberately absent:** any message reference, any media reference, any transcript
pointer, any "conversation summary".

### 3.4 `QueueEntry` (ephemeral, not in PostgreSQL)

| Field | Type | Notes |
| --- | --- | --- |
| `ticketId` | `uuidv7` | — |
| `participantId` | `uuid` | — |
| `mode` | `ChatMode` | — |
| `interestIds` | `uuid[]` | References the closed vocabulary |
| `language` | `string \| null` | BCP-47 |
| `regionConstraint` | `string \| null` | Coarse region code, not a location |
| `joinedAt` | `timestamp` | — |
| `expiresAt` | `timestamp` | Bounded wait |

**Never persisted to PostgreSQL.** A durable queue table would be a durable record of who
was looking for a stranger.

### 3.5 `Interest`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `slug` | `text` | From the closed vocabulary |
| `label` | `text` | Display label |
| `vocabularyVersion` | `int` | Versioned (ADR-009 IM-8) |
| `active` | `boolean` | Soft retirement without deleting history |

### 3.6 `SessionInterest` (join)

| Field | Type | Notes |
| --- | --- | --- |
| `sessionId` | `uuid` | FK |
| `interestId` | `uuid` | FK |

**Note:** interests attach to the *queue entry* primarily. A `SessionInterest` row exists
only to record what was requested at match time, and is retained with the session metadata
row. Interests are **never shown to the peer** (ADR-009 IM-3).

### 3.7 `Report`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `sessionId` | `uuid` | FK → ChatSession; may be terminal (INV-8) |
| `reporterIdentityId` | `uuid` | FK → SessionIdentity |
| `peerIdentityId` | `uuid` | FK → SessionIdentity |
| `category` | `ReportCategory` | Fixed enum |
| `severity` | `ReportSeverity` | P0 / P1 / P2 |
| `note` | `text \| null` | Optional, length-bounded, sanitised |
| `createdAt` | `timestamptz` | UTC |
| `dedupKey` | `text` | (sessionId, category) — unique |
| `status` | `ReportStatus` | `open` \| `triaged` \| `actioned` \| `insufficient` \| `closed` |

**Deliberately absent:** reporter name, email, phone, location, device fingerprint.

### 3.8 `Block`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `blockerIdentityId` | `uuid` | FK |
| `blockedIdentityId` | `uuid` | FK |
| `scope` | `BlockScope` | `session` \| `platform` |
| `createdAt` | `timestamptz` | — |
| `expiresAt` | `timestamptz \| null` | `null` for platform scope until reviewed |

### 3.9 `Ban`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `subjectType` | `BanSubjectType` | `session-identity` (default) |
| `subjectId` | `uuid` | FK |
| `reasonCode` | `text` | Enum, not free text |
| `severity` | `BanSeverity` | `minor` \| `major` \| `severe` |
| `source` | `BanSource` | `report` \| `signal` \| `admin` |
| `createdBy` | `uuid \| null` | FK → AdminUser; null for signal-sourced |
| `createdAt` | `timestamptz` | — |
| `expiresAt` | `timestamptz \| null` | `null` requires scheduled review |
| `appealStatus` | `AppealStatus` | — |
| `policyVersion` | `int` | The policy in force when issued |

**Deliberately absent:** IP address, device fingerprint, name, email.

### 3.10 `ModerationAction`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `caseId` | `uuid` | FK → ModerationCase |
| `actorId` | `uuid` | FK → AdminUser |
| `action` | `ModerationOutcome` | `allow` \| `warn` \| `disconnect` \| `restrict` \| `ban` \| `manual-review` |
| `reasonCode` | `text` | Required |
| `targetIdentityId` | `uuid \| null` | FK |
| `createdAt` | `timestamptz` | — |
| `policyVersion` | `int` | — |

### 3.11 `SafetyEvent`

Append-only record of safety-relevant occurrences.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `type` | `SafetyEventType` | `age-attested`, `consent-accepted`, `minor-detected`, `escalation-raised`, `session-terminated`, `rate-limit-triggered`, `protocol-violation` |
| `participantId` | `uuid \| null` | FK |
| `sessionId` | `uuid \| null` | FK |
| `payload` | `jsonb` | Type-specific, minimal, no content |
| `createdAt` | `timestamptz` | — |

### 3.12 `ConnectionEvent`

Ephemeral in-memory record; a small aggregate is written to `SafetyEvent` for
observability. Never contains candidate strings or addresses.

| Field | Type | Notes |
| --- | --- | --- |
| `sessionId` | `uuid` | — |
| `eventType` | `text` | `ice-restart`, `turn-used`, `setup-failed`, `permission-denied` |
| `reasonClass` | `text` | Enum |
| `occurredAt` | `timestamp` | — |

### 3.13 `AdminUser`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `role` | `AdminRole` | `moderator` \| `senior-moderator` \| `admin` |
| `status` | `text` | `active` \| `suspended` |
| `mfaEnrolled` | `boolean` | Required to be `true` for any role with enforcement power |
| `createdAt` | `timestamptz` | — |

**Deliberately absent:** a shared "admin" login. Every admin is an individual.

### 3.14 `AuditEvent`

Append-only, immutable, non-repudiable.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuidv7` | — |
| `actorId` | `uuid` | FK → AdminUser |
| `action` | `text` | Enum |
| `targetType` / `targetId` | `text` / `uuid` | — |
| `reasonCode` | `text` | — |
| `before` / `after` | `jsonb \| null` | Minimal state delta |
| `createdAt` | `timestamptz` | — |
| `policyVersion` | `int` | — |

No `UPDATE` or `DELETE` grants exist on this table for application roles.

---

## 4. Relationships

```
Participant 1───* SessionIdentity 1───* Report (as reporter)
                    │           └───────* Report (as peer)
                    │
Participant 1───* ChatSession (as A or B)
                    │
                    ├───* Report
                    ├───* SessionInterest *───1 Interest
                    └───* Block

SessionIdentity 1───* Ban
ModerationCase 1───* ModerationAction
AdminUser 1───* ModerationAction
AdminUser 1───* AuditEvent
Participant 1───* SafetyEvent
ChatSession 1───* SafetyEvent
```

---

## 5. Key constraints

| Constraint | Purpose |
| --- | --- |
| `UNIQUE (session_id, category)` on `Report` | Dedup (FR-REPORT-006) |
| Partial unique index: one non-terminal `ChatSession` per participant | INV-1, enforced by the database as well as the claim primitive |
| `CHECK (participant_a_id <> participant_b_id)` | INV-2 |
| No FK from any table to a "message" table | Because there is no message table |
| `AuditEvent` has no update/delete grants | FR-SAFE-006, FR-MOD-005 |
| All timestamps `timestamptz` in UTC | EC-24 |

---

## 6. Retention mapping

| Entity | Tier | Retention |
| --- | --- | --- |
| Chat messages | 0 | **Not stored** |
| `QueueEntry`, connection registry | 1 | Process lifetime |
| `ChatSession`, `SessionInterest` | 2 | 30 days |
| `Report`, `SafetyEvent` | 3 | 12 months |
| `Ban`, `ModerationAction`, `AuditEvent` | 4 | 24 months; indefinite bans reviewed |
| `SessionIdentity.riskSignalHash` | 6 | 7 days rolling |
| Telemetry | 5 | 13 months |

See [RETENTION.md](RETENTION.md).

---

## 7. Access patterns

| Query | Index | Frequency |
| --- | --- | --- |
| Is this identity banned? | `Ban(subject_id, expires_at)` where active | Every queue join, session creation, WS connect, TURN mint |
| Is there a block between A and B? | `Block(blocker_identity_id, blocked_identity_id)` | Every candidate selection |
| Reports for a session | `Report(session_id)` | Report dedup, triage |
| Reports against an identity | `Report(peer_identity_id, created_at)` | Repeat-offender detection |
| Session metadata older than 30 days | `ChatSession(created_at)` | Retention job (daily) |
| Recent peers for an identity | In-memory recent-peer window | Candidate selection |

---

## 8. What is explicitly not modelled

| Not modelled | Why |
| --- | --- |
| `User` / `Account` | No accounts (NG-4) |
| `Message` | No durable chat content (ADR-013 Tier 0) |
| `MediaRecording` | No recording (FR-MEDIA-008) |
| `Device` / `DeviceFingerprint` | No fingerprinting (ABUSE_PREVENTION.md) |
| `Friendship` / `Contact` | Strangers only |
| `Profile` | No public profiles (NG-1) |
| `Notification` | No push (NG-8) |
| `Payment` | No monetisation (NG-10) |

---

## 9. Implementation status

Repository **ports** exist in [src/server/db/](src/server/db/) and
[src/domain/](src/domain/). No driver is imported anywhere in the repository, no
connection string is configured, and every port function throws `Not implemented`.
