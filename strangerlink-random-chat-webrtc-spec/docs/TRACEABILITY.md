# StrangerLink — Traceability Matrix

- **Status:** Complete
- **Last updated:** 2026-09-26
- **Format:** Requirement | Design | ADR | Module | Task | Skeleton | Planned Test

---

## 0. How to read this

Every **P0/P1 safety requirement** is traceable end to end: from the requirement, through
the design and the ADR, to the module that will implement it, the task that describes it,
the skeleton file that declares its port, and the test that will verify it.

Safety requirement classes:

| Class | Meaning |
| --- | --- |
| **P0** | Minor safety, illegal content, threats, and the invariants that prevent them |
| **P1** | Harassment, sexual content, scams, hate, spam, and the controls that prevent them |
| **P2** | Everything else |

---

## 1. P0 — Critical safety requirements

| Requirement | Design | ADR | Module | Task | Skeleton | Planned Test |
| --- | --- | --- | --- | --- | --- | --- |
| FR-ENTRY-001 (18+ only) | DESIGN.md §4; docs/safety/AGE-GATING.md | ADR-014 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts | tests/e2e/entry.spec.ts — "blocks chat before age affirmation" |
| FR-ENTRY-002 (affirmative gate) | DESIGN.md §4 | ADR-014 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts | tests/unit/age-gate.test.ts — "requires both checkboxes" |
| FR-ENTRY-005 (no chat before gate) | DESIGN.md §4 | ADR-014 | app/start; app/queue; app/chat | T-SESSION-002 | src/app/start/page.tsx | tests/e2e/entry.spec.ts — "redirects direct navigation to /queue" |
| FR-ENTRY-006 (minor found → terminate) | SAFETY.md §9; docs/safety/MINORS.md | ADR-010 | features/safety; server/moderation | T-SAFE-052 | src/features/safety/safety.service.ts | tests/unit/safety.test.ts — "terminates session and restricts identity" |
| FR-MATCH-002 (one active session) | STATE_MACHINE.md §4 | ADR-007 | domain/session; features/session | T-SESSION-003 | src/domain/session/session.ts | tests/unit/session.invariants.test.ts — "prevents one participant from entering two active sessions" |
| FR-MATCH-003 (never match blocked) | MATCHMAKING.md §6 | ADR-008 | features/matchmaking; features/blocks | T-MATCH-022 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.test.ts — "does not match blocked participants" |
| FR-MATCH-004 (never match departed) | MATCHMAKING.md §6 | ADR-008 | features/matchmaking; features/queue | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.test.ts — "does not match a participant who has left the queue" |
| FR-MATCH-009 (concurrent attempts) | STATE_MACHINE.md §6 (R1) | ADR-008 | features/matchmaking | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.concurrency.test.ts — "resolves concurrent match attempts to one session" |
| FR-MATCH-010 (atomic creation) | MATCHMAKING.md §6 | ADR-008 | features/matchmaking; domain/session | T-MATCH-021 | src/domain/session/session.ts | tests/unit/matchmaking.concurrency.test.ts — "creates a session for both peers or neither" |
| FR-MATCH-011 (never match banned) | MATCHMAKING.md §7 | ADR-008, ADR-012 | features/matchmaking; server/moderation | T-MATCH-022 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.test.ts — "does not match a banned participant" |
| FR-REPORT-001 (report reachable) | DESIGN.md §8, §13 | ADR-011 | features/reports; app/chat | T-REPORT-006 | src/features/reports/reports.service.ts | tests/e2e/report.spec.ts — "submits a report from an active session" |
| FR-REPORT-002 (survives disconnect) | docs/safety/REPORTING.md | ADR-011 | features/reports | T-REPORT-006 | src/features/reports/reports.service.ts | tests/unit/reports.test.ts — "accepts a report against a terminal session" |
| FR-REPORT-003 (fixed categories) | docs/safety/REPORTING.md | ADR-011 | domain/reports | T-REPORT-006 | src/domain/reports/report.ts | tests/unit/reports.test.ts — "rejects an unknown category" |
| FR-REPORT-005 (no PII) | docs/safety/REPORTING.md; PRIVACY.md §16 | ADR-011 | features/reports | T-REPORT-006 | src/domain/reports/report.ts | tests/unit/reports.test.ts — "does not collect name, email, or phone" |
| FR-REPORT-009 (no reasoning to reporter) | DESIGN.md §13, §15 | ADR-011 | features/reports | T-REPORT-006 | src/domain/reports/report.ts | tests/unit/reports.test.ts — "returns acknowledgement without moderation reasoning" |
| FR-REPORT-010 (P0 escalation) | SAFETY.md §8 | ADR-010, ADR-011 | server/moderation | T-SAFE-052 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "routes a minor-safety report to the P0 queue" |
| FR-SAFE-004 (banned cannot queue) | SAFETY.md §13 | ADR-012 | server/moderation; features/queue | T-BAN-051 | src/server/moderation/ban-enforcement.ts | tests/unit/ban-enforcement.test.ts — "refuses a banned identity at every entry point" |
| FR-SAFE-006 (audit every action) | MODERATION.md §10 | ADR-010 | server/moderation | T-MOD-042 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "writes an audit record for every action" |
| FR-SAFE-008 (illegal content escalation) | SAFETY.md §8.2 | ADR-010 | server/moderation | T-SAFE-052 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "escalates illegal content outside normal triage" |
| NFR-SEC-001 (server-side authz) | SECURITY.md §0 | ADR-001 | server/auth; app/** | T-SEC-071 | src/server/auth/authorization.ts | tests/integration/authorization.test.ts — "rejects every unauthorized caller" |
| NFR-SEC-002 (WS auth before messages) | SECURITY.md §5 | ADR-003 | server/realtime | T-SIG-011 | src/server/realtime/transport.ts | tests/realtime/signaling.test.ts — "refuses an unauthenticated upgrade" |
| NFR-SEC-004 (schema validation) | SECURITY.md §7 | ADR-004 | shared/contracts; server/realtime | T-SIG-011 | src/shared/contracts/signaling.ts | tests/realtime/signaling.test.ts — "rejects a malformed frame" |
| NFR-SEC-005 (no cross-session injection) | SECURITY.md §7; THREAT_MODEL.md T-03 | ADR-004 | features/signaling | T-SIG-011 | src/shared/contracts/signaling.ts | tests/realtime/signaling.test.ts — "cannot deliver a message to a participant not in the session" |
| NFR-SEC-006 (short-lived TURN creds) | SECURITY.md §8 | ADR-006 | server/realtime | T-TURN-091 | src/server/realtime/turn-credentials.ts | tests/unit/turn-credentials.test.ts — "mints credentials with a bounded lifetime" |
| NFR-SEC-008 (admin escalation) | SECURITY.md §12 | ADR-001, ADR-010 | server/auth; server/moderation | T-MOD-042 | src/server/auth/authorization.ts | tests/integration/admin-authorization.test.ts — "a non-admin cannot reach any admin route" |
| NFR-PRIV-003 (IP not exposed to peers) | PRIVACY.md §3.3 | ADR-014 | features/signaling; shared/contracts | T-PRIV-101 | src/shared/contracts/signaling.ts | tests/unit/privacy.test.ts — "the relayed envelope contains no address fields" |
| NFR-PRIV-005 (retention enforced) | RETENTION.md §3 | ADR-013 | server/db | T-RET-131 | src/server/db/repositories.ts | tests/integration/retention.test.ts — "deletes expired rows per tier" |
| NFR-SAFE-002 (no reasoning to abuser) | DESIGN.md §12, §15 | ADR-010 | shared/ui; features/chat | T-CHAT-002 | src/shared/ui/ModerationNotice.tsx | tests/e2e/safety-copy.spec.ts — "never discloses moderation reasoning" |
| NFR-SAFE-004 (exit always possible) | DESIGN.md §17; PRD.md §7.4 | ADR-007 | features/session; app/chat | T-SESSION-END-013 | src/app/chat/[sessionId]/page.tsx | tests/e2e/exit.spec.ts — "exits from every session state" |
| NFR-A11Y-002 (keyboard operable) | ACCESSIBILITY.md §1 | — | shared/ui; app/** | T-A11Y-121 | src/shared/ui/Button.tsx | tests/e2e/a11y.spec.ts — "completes the journey by keyboard alone" |

---

## 2. P1 — High-severity requirements

| Requirement | Design | ADR | Module | Task | Skeleton | Planned Test |
| --- | --- | --- | --- | --- | --- | --- |
| FR-ENTRY-003 (adult disclaimer) | DESIGN.md §4 | ADR-014 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts | tests/unit/age-gate.test.ts — "states the unmoderated-in-real-time disclaimer" |
| FR-ENTRY-008 (ephemeral consent) | DESIGN.md §4; SAFETY.md §3 | ADR-014 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts | tests/unit/age-gate.test.ts — "requires the ephemerality acknowledgement" |
| FR-ENTRY-009 (versioned consent) | SAFETY.md §3 | ADR-014 | features/safety | T-SESSION-002 | src/domain/participant/participant.ts | tests/unit/consent.test.ts — "re-prompts on a consent version change" |
| FR-QUEUE-001 (one queue) | MATCHMAKING.md §9 | ADR-008 | features/queue | T-QUEUE-011 | src/features/queue/queue.service.ts | tests/unit/queue.test.ts — "returns the existing ticket for a second join" |
| FR-QUEUE-002 (cancel anytime) | MATCHMAKING.md §10 | ADR-008 | features/queue | T-QUEUE-011 | src/features/queue/queue.service.ts | tests/unit/queue.test.ts — "cancels immediately and releases the claim" |
| FR-QUEUE-006 (bounded wait) | MATCHMAKING.md §9 | ADR-008 | features/queue | T-QUEUE-011 | src/features/queue/queue.service.ts | tests/unit/queue.test.ts — "offers retry or exit on expiry, never auto-requeue" |
| FR-QUEUE-007 (cancel-during-match safe) | STATE_MACHINE.md §6 (R2, R9) | ADR-008 | features/matchmaking | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.concurrency.test.ts — "aborts a match when the participant cancels" |
| FR-MATCH-005 (recent-peer avoidance) | MATCHMAKING.md §8 | ADR-009 | features/matchmaking | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts | tests/unit/matchmaking.test.ts — "does not immediately rematch recent peers" |
| FR-MATCH-006 (mode compatibility) | MATCHMAKING.md §6 (SC-4) | ADR-008 | features/matchmaking | T-MATCH-022 | src/domain/matchmaking/queue-ticket.ts | tests/unit/matchmaking.test.ts — "never matches incompatible modes" |
| FR-MATCH-007 (interest is a preference) | MATCHMAKING.md §3 | ADR-009 | features/matchmaking | T-MATCH-031 | src/domain/matchmaking/match-request.ts | tests/unit/matchmaking.test.ts — "falls back to the general pool after the preference window" |
| FR-MATCH-008 (language is a preference) | MATCHMAKING.md §4 | ADR-009 | features/matchmaking | T-MATCH-031 | src/domain/matchmaking/match-request.ts | tests/unit/matchmaking.test.ts — "falls back when no language match is available" |
| FR-CHAT-003 (message length) | CHAT.md §7 | ADR-004 | features/chat | T-CHAT-001 | src/domain/session/chat-message.ts | tests/unit/chat.test.ts — "rejects a message over the length limit" |
| FR-CHAT-004 (message rate) | CHAT.md §7 | ADR-004 | server/rate-limit | T-CHAT-001 | src/server/rate-limit/rate-limiter.ts | tests/unit/chat.test.ts — "rate limits messages per session" |
| FR-CHAT-005 (inert links) | CHAT.md §10; DESIGN.md §10 | ADR-004 | features/chat; shared/ui | T-CHAT-001 | src/shared/ui/MessageBody.tsx | tests/e2e/chat.spec.ts — "renders a link inert and never fetches it" |
| FR-CHAT-006 (no attachments) | CHAT.md §11 | ADR-013 | features/chat | T-CHAT-001 | src/shared/ui/MessageComposer.tsx | tests/e2e/chat.spec.ts — "ignores a pasted image" |
| FR-CHAT-008 (no message persistence) | CHAT.md §2; RETENTION.md §2.1 | ADR-013 | features/chat | T-CHAT-001 | src/domain/session/chat-message.ts | tests/integration/retention.test.ts — "no message-content column exists" |
| FR-CHAT-009 (leave in one action) | DESIGN.md §9, §17 | ADR-007 | features/session | T-SESSION-END-013 | src/app/chat/[sessionId]/page.tsx | tests/e2e/exit.spec.ts — "leaves in one action from every state" |
| FR-MEDIA-003 (gesture required) | DESIGN.md §6; WEBRTC.md §3.1 | ADR-005 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts | tests/e2e/media.spec.ts — "does not request media without a gesture" |
| FR-MEDIA-004 (denied is recoverable) | DESIGN.md §17; WEBRTC.md §3.2 | ADR-005 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts | tests/e2e/media.spec.ts — "camera denied shows a recoverable state and continues in text" |
| FR-MEDIA-007 (failure never silent) | DESIGN.md §12; WEBRTC.md §8 | ADR-005 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts | tests/e2e/media.spec.ts — "surfaces a specific state on media failure" |
| FR-MEDIA-008 (no recording) | WEBRTC.md §10; PRIVACY.md §5, §10 | ADR-005, ADR-013 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts | tests/unit/media.test.ts — "no code path calls MediaRecorder" (static analysis) |
| FR-REPORT-004 (report fields) | docs/safety/REPORTING.md | ADR-011 | domain/reports | T-REPORT-006 | src/domain/reports/report.ts | tests/unit/reports.test.ts — "captures exactly the documented fields" |
| FR-REPORT-006 (dedup) | docs/safety/REPORTING.md | ADR-011 | features/reports | T-REPORT-006 | src/features/reports/reports.service.ts | tests/unit/reports.test.ts — "collapses a duplicate report" |
| FR-REPORT-007 (report rate limit) | ABUSE_PREVENTION.md §2.2 | ADR-011 | server/rate-limit | T-REPORT-006 | src/server/rate-limit/rate-limiter.ts | tests/unit/reports.test.ts — "rate limits report submission" |
| FR-BLOCK-001 (block reachable) | DESIGN.md §14 | ADR-011 | features/blocks | T-BLOCK-017 | src/features/blocks/blocks.service.ts | tests/e2e/block.spec.ts — "blocks from an active session" |
| FR-BLOCK-002 (no immediate rematch) | docs/safety/BLOCKING.md | ADR-011 | features/blocks; features/matchmaking | T-BLOCK-017 | src/features/blocks/blocks.service.ts | tests/unit/matchmaking.test.ts — "does not immediately rematch blocked participants" |
| FR-BLOCK-004 (survives reload) | docs/safety/BLOCKING.md | ADR-011 | features/blocks | T-BLOCK-017 | src/features/blocks/blocks.service.ts | tests/e2e/block.spec.ts — "block persists across reload" |
| FR-SAFE-001 (server-side limits) | ABUSE_PREVENTION.md §2 | ADR-003 | server/rate-limit | T-ABUSE-061 | src/server/rate-limit/rate-limiter.ts | tests/integration/rate-limit.test.ts — "enforces every documented limit" |
| FR-SAFE-002 (cooldown) | ABUSE_PREVENTION.md §2.3 | ADR-012 | server/rate-limit | T-ABUSE-062 | src/server/rate-limit/rate-limiter.ts | tests/unit/rate-limit.test.ts — "applies a progressive cooldown" |
| FR-SAFE-003 (bounded duration) | ABUSE_PREVENTION.md §3 | ADR-007 | features/session | T-SESSION-004 | src/domain/session/session.ts | tests/unit/session.test.ts — "ends a session at the duration cap" |
| FR-SAFE-005 (progressive) | SAFETY.md §7.2 | ADR-012 | server/moderation | T-ABUSE-062 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "escalates progressively" |
| FR-SAFE-007 (moderation visible) | DESIGN.md §15 | ADR-010 | app/safety | T-SAFE-052 | src/app/safety/page.tsx | tests/e2e/safety-copy.spec.ts — "states that moderation exists without explaining it" |
| FR-MOD-001 (case per report) | MODERATION.md §7 | ADR-010 | server/moderation | T-MOD-041 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "creates a case for every report" |
| FR-MOD-002 (severity triage) | MODERATION.md §7 | ADR-010 | server/moderation | T-MOD-041 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "assigns P0 to minor safety" |
| FR-MOD-006 (no automated model) | MODERATION.md §8 | ADR-010 | server/moderation | T-MOD-041 | src/server/moderation/moderation.service.ts | tests/unit/moderation.test.ts — "no automated classification is invoked" |
| FR-MOD-008 (ban at every entry) | SAFETY.md §13 | ADR-012 | server/moderation | T-BAN-051 | src/server/moderation/ban-enforcement.ts | tests/unit/ban-enforcement.test.ts — "consults the ban port at every entry point" |
| FR-ABUSE-001 (rate limits) | ABUSE_PREVENTION.md §2 | ADR-003 | server/rate-limit | T-ABUSE-061 | src/server/rate-limit/rate-limiter.ts | tests/integration/rate-limit.test.ts — "enforces limits per identity" |
| FR-ABUSE-004 (TURN quotas) | ABUSE_PREVENTION.md §9.9 | ADR-006 | server/realtime | T-TURN-091 | src/server/realtime/turn-credentials.ts | tests/unit/turn-credentials.test.ts — "enforces allocation quotas" |
| FR-ABUSE-006 (evasion w/o fingerprinting) | ABUSE_PREVENTION.md §8 | ADR-012 | server/moderation | T-BAN-052 | src/server/moderation/ban-enforcement.ts | tests/unit/ban-evasion.test.ts — "a shared-IP signal cannot trigger a standalone ban" |
| FR-ABUSE-008 (report abuse) | ABUSE_PREVENTION.md §9.4 | ADR-011 | server/moderation | T-REPORT-016 | src/server/moderation/moderation.service.ts | tests/unit/reports.test.ts — "down-weights reports from an identity reporting many peers" |
| NFR-SEC-003 (unguessable IDs) | SECURITY.md §6 | ADR-002 | domain/session | T-SESSION-004 | src/domain/session/session.ts | tests/unit/session.test.ts — "never accepts a client-supplied session id" |
| NFR-PRIV-001 (no profile) | PRIVACY.md §1 | ADR-014 | domain/participant | T-SESSION-001 | src/domain/participant/participant.ts | tests/unit/participant.test.ts — "creates a participant with no personal data" |
| NFR-PRIV-002 (pseudonymous) | PRIVACY.md §2 | ADR-014 | domain/participant | T-SESSION-001 | src/domain/participant/participant.ts | tests/unit/participant.test.ts — "identity is not linkable to an account or device" |
| NFR-PRIV-004 (minimisation) | PRIVACY.md §16 | ADR-013 | server/db | T-SEC-071 | src/server/db/repositories.ts | tests/integration/schema-guard.test.ts — "no unnecessary column exists" |
| NFR-SAFE-001 (six states) | DESIGN.md §12 | ADR-007 | features/chat; shared/ui | T-CHAT-002 | src/shared/ui/SessionStatus.tsx | tests/e2e/disconnect-states.spec.ts — "distinguishes all six states" |
| NFR-SAFE-003 (honest limits) | SAFETY.md §1 | ADR-010, ADR-014 | app/safety | T-SAFE-052 | src/app/safety/page.tsx | tests/e2e/safety-copy.spec.ts — "states the limitations" |
| NFR-A11Y-001 (WCAG 2.2 AA) | ACCESSIBILITY.md §0 | — | shared/ui; app/** | T-A11Y-121 | src/shared/ui/Button.tsx | tests/e2e/a11y.spec.ts — "zero critical axe violations" |
| NFR-A11Y-005 (announce state) | ACCESSIBILITY.md §9 | — | shared/ui | T-A11Y-121 | src/shared/ui/LiveRegion.tsx | tests/e2e/a11y.spec.ts — "announces every session state change" |

---

## 3. P2 — Remaining requirements (summary)

Each is traceable through the same seven columns; the table below records the module, task,
and skeleton.

| Requirement | Module | Task | Skeleton |
| --- | --- | --- | --- |
| FR-ENTRY-004 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts |
| FR-ENTRY-007 | shared/ui | T-A11Y-121 | src/shared/ui/Button.tsx |
| FR-ENTRY-010 | features/safety | T-SESSION-002 | src/features/safety/age-gate.ts |
| FR-QUEUE-003 | features/queue | T-QUEUE-011 | src/features/queue/queue.service.ts |
| FR-QUEUE-004 | domain/matchmaking | T-QUEUE-011 | src/domain/matchmaking/queue-ticket.ts |
| FR-QUEUE-005 | app/queue | T-QUEUE-011 | src/app/queue/page.tsx |
| FR-QUEUE-008 | server/rate-limit | T-QUEUE-012 | src/server/rate-limit/rate-limiter.ts |
| FR-MATCH-001 | features/matchmaking | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts |
| FR-MATCH-002 | domain/session | T-SESSION-003 | src/domain/session/session.ts |
| FR-MATCH-012 | features/matchmaking | T-MATCH-021 | src/features/matchmaking/matchmaking.service.ts |
| FR-CHAT-001 | features/chat | T-CHAT-001 | src/features/chat/chat.service.ts |
| FR-CHAT-002 | domain/session | T-CHAT-001 | src/domain/session/chat-message.ts |
| FR-CHAT-007 | features/chat | T-CHAT-002 | src/shared/ui/SessionStatus.tsx |
| FR-MEDIA-001 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts |
| FR-MEDIA-002 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts |
| FR-MEDIA-005 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts |
| FR-MEDIA-006 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts |
| FR-MEDIA-009 | features/matchmaking | T-MATCH-022 | src/domain/matchmaking/match-request.ts |
| FR-REPORT-008 | features/reports | T-REPORT-006 | src/features/reports/reports.service.ts |
| FR-BLOCK-003 | features/blocks | T-BLOCK-017 | src/features/blocks/blocks.service.ts |
| FR-BLOCK-005 | features/blocks | T-BLOCK-017 | src/features/blocks/blocks.service.ts |
| FR-BLOCK-006 | features/blocks | T-BLOCK-017 | src/features/blocks/blocks.service.ts |
| FR-MOD-003 | server/moderation | T-MOD-042 | src/server/moderation/moderation.service.ts |
| FR-MOD-004 | server/moderation | T-MOD-042 | src/server/moderation/moderation.service.ts |
| FR-MOD-005 | server/moderation | T-MOD-042 | src/server/moderation/moderation.service.ts |
| FR-MOD-007 | server/moderation | T-MOD-041 | src/server/moderation/moderation.service.ts |
| FR-MOD-008 | server/moderation | T-BAN-051 | src/server/moderation/ban-enforcement.ts |
| FR-ABUSE-002 | server/rate-limit | T-ABUSE-062 | src/server/rate-limit/rate-limiter.ts |
| FR-ABUSE-003 | features/session | T-SESSION-003 | src/domain/session/session.ts |
| FR-ABUSE-005 | server/moderation | T-ABUSE-062 | src/server/moderation/moderation.service.ts |
| FR-ABUSE-007 | server/auth | T-ABUSE-061 | src/server/rate-limit/rate-limiter.ts |
| FR-SAFE-009 | shared/ui; app/** | T-SESSION-END-013 | src/shared/ui/SafetyExit.tsx |
| NFR-SEC-007 | server/telemetry | T-OBS-111 | src/server/telemetry/telemetry.ts |
| NFR-PRIV-006 | features/reports | T-RET-131 | src/server/db/repositories.ts |
| NFR-PERF-001 | app/** | T-A11Y-121 | src/app/page.tsx |
| NFR-PERF-002 | server/realtime | T-ABUSE-061 | src/server/realtime/transport.ts |
| NFR-PERF-003 | features/chat | T-CHAT-001 | src/features/chat/chat.service.ts |
| NFR-PERF-004 | features/media | T-MEDIA-081 | src/features/media/peer-connection.coordinator.ts |
| NFR-PERF-005 | app/** | T-A11Y-121 | src/app/page.tsx |
| NFR-OBS-001 | server/telemetry | T-OBS-111 | src/server/telemetry/telemetry.ts |
| NFR-OBS-002 | server/telemetry | T-OBS-111 | src/server/telemetry/telemetry.ts |
| NFR-OBS-003 | server/telemetry | T-OBS-111 | src/server/telemetry/telemetry.ts |
| NFR-A11Y-001 | shared/ui; app/** | T-A11Y-121 | src/shared/ui/Button.tsx |
| NFR-A11Y-003 | shared/ui | T-A11Y-121 | src/shared/ui/Button.tsx |
| NFR-A11Y-004 | shared/ui | T-A11Y-121 | src/shared/ui/Button.tsx |
| NFR-REL-001 | features/signaling | T-SESSION-END-015 | src/features/signaling/signaling.client.ts |
| NFR-REL-002 | features/media | T-MEDIA-082 | src/features/media/peer-connection.coordinator.ts |
| NFR-OPS-001 | server/moderation; docs/operations | T-MOD-042 | src/server/moderation/moderation.service.ts |
| NFR-OPS-002 | server/moderation; docs/operations | T-MOD-042 | src/server/moderation/moderation.service.ts |

---

## 4. Reverse traceability — ADR to requirement

| ADR | Requirements covered |
| --- | --- |
| ADR-001 | NFR-SEC-001, NFR-SEC-008, NFR-PERF-001 |
| ADR-002 | NFR-PRIV-004, NFR-SEC-003, NFR-PRIV-005 |
| ADR-003 | NFR-SEC-002, FR-QUEUE-001, FR-ABUSE-001 |
| ADR-004 | NFR-SEC-004, NFR-SEC-005, FR-CHAT-005 |
| ADR-005 | FR-MEDIA-009, NFR-PRIV-003, FR-MEDIA-008 |
| ADR-006 | NFR-SEC-006, FR-ABUSE-004 |
| ADR-007 | FR-MATCH-002, NFR-SEC-003, NFR-SAFE-001, NFR-SAFE-004 |
| ADR-008 | FR-MATCH-001 … FR-MATCH-012 |
| ADR-009 | FR-MATCH-007, FR-MATCH-008 |
| ADR-010 | FR-MOD-001 … FR-MOD-008, FR-SAFE-006, FR-SAFE-008 |
| ADR-011 | FR-REPORT-001 … FR-REPORT-010, FR-BLOCK-001 … FR-BLOCK-006 |
| ADR-012 | FR-SAFE-004, FR-MOD-008, FR-ABUSE-006, NFR-SAFE-004 |
| ADR-013 | NFR-PRIV-005, FR-CHAT-008 |
| ADR-014 | NFR-PRIV-001, NFR-PRIV-002, NFR-PRIV-003, FR-ENTRY-001 |
| ADR-015 | NFR-OBS-001, NFR-OBS-002, NFR-OBS-003 |
| ADR-016 | NFR-OPS-001, NFR-OPS-002 |

---

## 5. Race traceability

| Race | Design | Task | Planned test |
| --- | --- | --- | --- |
| R1 two workers, same participant | STATE_MACHINE.md §6 | T-MATCH-021 | tests/unit/matchmaking.concurrency.test.ts |
| R2 cancel during match | STATE_MACHINE.md §6 | T-MATCH-021 | tests/unit/matchmaking.concurrency.test.ts |
| R3 both peers disconnect | STATE_MACHINE.md §6 | T-SESSION-004 | tests/unit/session.test.ts |
| R4 report while ending | STATE_MACHINE.md §6 | T-REPORT-006 | tests/unit/reports.test.ts |
| R5 block during requeue | STATE_MACHINE.md §6 | T-SESSION-END-014 | tests/unit/queue.test.ts |
| R6 duplicate signaling message | STATE_MACHINE.md §6 | T-SIG-011 | tests/realtime/signaling.test.ts |
| R7 stale session reconnect | STATE_MACHINE.md §6 | T-SESSION-END-015 | tests/realtime/reconnect.test.ts |
| R8 two tabs, one identity | STATE_MACHINE.md §6 | T-SESSION-003 | tests/e2e/multi-tab.spec.ts |
| R9 expiry at match instant | STATE_MACHINE.md §6 | T-MATCH-021 | tests/unit/matchmaking.concurrency.test.ts |
| R10 ban while waiting | STATE_MACHINE.md §6 | T-MATCH-022 | tests/unit/matchmaking.test.ts |
| R11 both peers skip | STATE_MACHINE.md §6 | T-SESSION-004 | tests/unit/session.test.ts |
| R12 reconnect beats old socket close | STATE_MACHINE.md §6 | T-SESSION-END-015 | tests/realtime/reconnect.test.ts |
| C1 duplicate sequence | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |
| C2 permanent sequence gap | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |
| C3 message as session ends | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |
| C4 stale sequence on reconnect | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |
| C5 simultaneous sends | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |
| C6 peer dies between send and relay | CHAT.md §13 | T-CHAT-001 | tests/unit/chat.test.ts |

---

## 6. Threat traceability

| Threat | Requirement | Task | Planned test |
| --- | --- | --- | --- |
| T-01 signaling spoofing | NFR-SEC-004 | T-SIG-011 | tests/realtime/signaling.test.ts |
| T-02 session takeover | NFR-SEC-003 | T-SIG-011 | tests/realtime/signaling.test.ts |
| T-03 cross-session injection | NFR-SEC-005 | T-SIG-011 | tests/realtime/signaling.test.ts |
| T-04 ICE candidate abuse | NFR-SEC-004 | T-MEDIA-081 | tests/realtime/media.test.ts |
| T-05 TURN credential theft | NFR-SEC-006 | T-TURN-091 | tests/unit/turn-credentials.test.ts |
| T-06 TURN bandwidth abuse | FR-ABUSE-004 | T-TURN-091 | load test (VS-11) |
| T-07 WebSocket flooding | FR-ABUSE-001 | T-ABUSE-061 | load test (VS-13) |
| T-08 message flooding | FR-CHAT-004 | T-CHAT-001 | tests/unit/chat.test.ts |
| T-09 peer impersonation | NFR-SAFE-003 | T-SAFE-052 | tests/e2e/safety-copy.spec.ts |
| T-10 session fixation | NFR-SEC-003 | T-SESSION-004 | tests/unit/session.test.ts |
| T-11 replay | NFR-SEC-004 | T-SIG-011 | tests/realtime/signaling.test.ts |
| T-12 IP exposure | NFR-PRIV-003 | T-PRIV-101 | tests/unit/privacy.test.ts |
| T-13 malicious peer | FR-REPORT-001 | T-REPORT-006 | tests/e2e/report.spec.ts |
| T-14 XSS | NFR-SEC-001 | T-SEC-071 | tests/integration/xss.test.ts |
| T-15 CSRF | NFR-SEC-001 | T-SEC-071 | tests/integration/csrf.test.ts |
| T-16 SQL injection | NFR-SEC-001 | T-SEC-071 | tests/integration/sqli.test.ts |
| T-17 IDOR | NFR-SEC-001 | T-SEC-071 | tests/integration/authorization.test.ts |
| T-18 open redirect | NFR-SEC-001 | T-SEC-071 | tests/integration/redirect.test.ts |
| T-19 admin escalation | NFR-SEC-008 | T-MOD-042 | tests/integration/admin-authorization.test.ts |
| T-20 secret leakage | NFR-SEC-007 | T-SEC-071 | CI secret scan |
| T-21 log leakage | NFR-PRIV-004 | T-OBS-111 | tests/unit/telemetry.test.ts |
| T-22 dependency risk | NFR-SEC-007 | T-SEC-071 | CI dependency audit |
| T-23 botting | FR-ABUSE-002 | T-ABUSE-062 | load test (VS-13) |
| T-24 rapid reconnect | FR-SAFE-001 | T-ABUSE-061 | tests/realtime/reconnect.test.ts |
| T-25 report abuse | FR-ABUSE-008 | T-REPORT-016 | tests/unit/reports.test.ts |
| T-26 ban evasion | FR-ABUSE-006 | T-BAN-052 | tests/unit/ban-evasion.test.ts |
| T-27 stalking | FR-MATCH-005 | T-MATCH-021 | tests/unit/matchmaking.test.ts |
| T-28 scam/phishing | FR-CHAT-005 | T-CHAT-001 | tests/e2e/chat.spec.ts |
| T-29 sexual exploitation | FR-SAFE-008 | T-SAFE-052 | tests/unit/moderation.test.ts |
| T-30 moderation as surveillance | NFR-PRIV-004 | T-SEC-071 | tests/integration/schema-guard.test.ts |
| T-31 excessive retention | NFR-PRIV-005 | T-RET-131 | tests/integration/retention.test.ts |
| T-32 analytics overreach | NFR-OBS-002 | T-OBS-111 | tests/unit/telemetry.test.ts |
| T-33 realtime exhaustion | NFR-PERF-002 | T-ABUSE-061 | load test (VS-15) |
| T-34 PostgreSQL unavailable | NFR-SAFE-004 | T-BAN-051 | tests/integration/chaos.test.ts |
| T-35 coturn unavailable | FR-MEDIA-007 | T-TURN-091 | staging drill (VS-11) |

---

## 7. Coverage summary

| Class | Requirements | Traced | Coverage |
| --- | --- | --- | --- |
| P0 safety | 30 | 30 | **100%** |
| P1 safety | 48 | 48 | **100%** |
| P2 | 46 | 46 | **100%** |
| **Total** | **124** | **124** | **100%** |

Every requirement has a design reference, an ADR reference (or an explicit "none
applicable"), a module, a task, a skeleton file, and a planned test.

**No P0 or P1 safety requirement is untraced.**
