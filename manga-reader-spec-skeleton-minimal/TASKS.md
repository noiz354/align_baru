# Implementation task backlog

Tasks authorize future work only. Each task is not executed now. IDs are stable; task graph must be reconciled with ADRs at execution.

## EPIC-01 Foundation

## T-FOUND-001 — Initialize strict application/tooling baseline

Requirements: NFR-SEC-001, NFR-OBS-001

Goal: Create approved Node/TypeScript/Next skeleton and CI gates without product features.

Depends on: none (first implementation task).

Expected modules: src/app, configuration, .github/workflows

Inputs: Runtime/version policy, build config

Expected behavior:
Add strict configuration; validate Node 24 and stable framework compatibility; CI performs type/lint/build only.

Important edge cases: unsupported runtime, environment leakage

Security: No secrets in config; minimal CI token permissions

Testing: config tests, typecheck, lint

Manual QA: Verify clean install and production build without feature data.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-CHAPTER-001 — Chapter ordering and lifecycle

Requirements: FR-CATALOG-002, FR-ADMIN-002

Goal: Manage stable published chapter sequence.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/chapters, features/admin

Inputs: work and chapter metadata

Expected behavior:
Enforce uniqueness and publication boundary.

Important edge cases: reorder collision, open removed chapter

Security: scoped edit

Testing: DB integration and concurrency

Manual QA: Verify sequence publicly.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-02 Catalog

## T-CAT-001 — Catalog read contracts

Requirements: FR-CATALOG-001, FR-CATALOG-002

Goal: Deliver stable catalog/detail DTO contracts.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/catalog, features/manga

Inputs: filters, cursor, slug

Expected behavior:
Published-only responses and explicit pagination/error semantics.

Important edge cases: unpublished, missing work, aliases

Security: Prevent enumeration of hidden content

Testing: contract and authorization tests

Manual QA: Browse known authorized catalog.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-OBS-001 — Request trace and safe metric foundations

Requirements: NFR-OBS-001

Goal: Instrument request boundaries with safe correlation and low-cardinality metrics.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: server/telemetry

Inputs: request context

Expected behavior:
Propagate trace context and redact data; no application PII labels.

Important edge cases: missing trace, exporter outage

Security: redaction and no signed URLs

Testing: telemetry tests and log inspection

Manual QA: Trace a catalog request safely.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-03 Reader

## T-READER-001 — Chapter manifest contract and route shell

Requirements: FR-READER-001, FR-READER-002, FR-READER-003

Goal: Establish reader boundary with explicit page order, mode and direction.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader, features/chapters, src/app

Inputs: chapter identifier

Expected behavior:
Expose ordered manifest DTO without storage secrets; route shell only.

Important edge cases: zero/one page, deleted chapter, invalid order

Security: Authorization and no physical key exposure

Testing: contract tests, empty route E2E

Manual QA: Open authorized chapter; verify shell communicates state.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-READER-002 — Initial page presentation

Requirements: FR-READER-001, FR-READER-006, FR-READER-007

Goal: Present currently visible page(s) accessibly.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader, media contract

Inputs: manifest and viewport

Expected behavior:
Render loading/success/error boundaries; no navigation algorithm in task until authorized.

Important edge cases: slow/offline/failed image

Security: safe controlled URLs

Testing: browser tests and accessibility check

Manual QA: Mobile and desktop first page.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-READER-031 — Bounded reader loading window

Requirements: NFR-PERF-013, NFR-PERF-014

Goal: Keep near pages active with bounded resource window.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader

Inputs: current page, page count, mode

Expected behavior:
Implement only after explicit task authorization and documented memory measurements.

Important edge cases: first/last page, rapid seek, mode switch, 500 pages

Security: Do not bypass media authorization

Testing: unit/property tests and memory stress

Manual QA: Navigate 50/100/200/500 page chapters.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-READER-021 — Persist reader progress

Requirements: FR-READER-014, FR-LIBRARY-006, NFR-DATA-003

Goal: Persist authenticated reader chapter position.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader, features/progress, server/db

Inputs: identity, chapter ID, page index/version

Expected behavior:
Validate chapter/page relationship; save latest under approved concurrency policy.

Important edge cases: anonymous, deleted chapter, invalid index, duplicate update, tabs

Security: Owner-only modification

Testing: unit/integration/authorization/concurrency

Manual QA: Open → move → reload → restore.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-PERF-001 — Large chapter performance qualification

Requirements: NFR-PERF-001, NFR-PERF-014

Goal: Prove memory/latency budgets at 500 pages.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader, tests/e2e

Inputs: benchmark chapters

Expected behavior:
Measure O(window) resource behavior and degraded network.

Important edge cases: rapid navigation, decode failure

Security: no unsafe caching

Testing: load/memory/network stress

Manual QA: Throttle network; inspect heap and page quality.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-DEPLOY-001 — Staged deployment and rollback

Requirements: NFR-REL-001

Goal: Ship immutable artifact with readiness and rollback.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: deployment, CI

Inputs: artifact/config

Expected behavior:
Apply protected rollout and smoke verification.

Important edge cases: DB compatibility, health failure

Security: secret management and least privilege

Testing: deployment rehearsal

Manual QA: Rollback staging and verify.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-04 Authentication

## T-AUTH-004 — Authentication provider integration

Requirements: FR-AUTH-001, NFR-SEC-001

Goal: Implement selected mature authentication approach after ADR-006 provider decision.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/auth, server/auth

Inputs: provider callback/credential contract

Expected behavior:
No custom cryptography; secure lifecycle and generic failure behavior.

Important edge cases: expired/revoked session, abuse, provider outage

Security: cookie, CSRF, throttling and log redaction

Testing: auth integration and browser session tests

Manual QA: Sign in/out/revoke on supported devices.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-05 Library

## T-LIB-001 — Library and bookmark ownership

Requirements: FR-LIBRARY-001, FR-LIBRARY-003

Goal: Enable personal save state.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/library, server/db

Inputs: user and manga/page refs

Expected behavior:
Enforce owner scope and valid targets.

Important edge cases: deleted work, duplicate

Security: IDOR protection

Testing: unit/integration/E2E

Manual QA: Save and remove a work.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-HIST-001 — Reading history and retention

Requirements: FR-LIBRARY-004, NFR-DATA-003

Goal: Record privacy-limited reading history.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/progress, server/db

Inputs: user/chapter/occurred time

Expected behavior:
Apply retention and deletion policy.

Important edge cases: unpublished chapter, user deletion

Security: minimize personal data

Testing: retention integration tests

Manual QA: Verify history and deletion.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-PREF-001 — Reader preferences

Requirements: FR-LIBRARY-005

Goal: Persist validated reader settings.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/library, features/reader

Inputs: versioned preference DTO

Expected behavior:
Honor accessibility overrides.

Important edge cases: old schema, invalid mode

Security: owner only

Testing: schema and E2E

Manual QA: Change preference across sessions.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-06 Admin

## T-ADMIN-001 — Role-protected catalog publication

Requirements: FR-ADMIN-001, FR-ADMIN-003

Goal: Implement draft/edit/publish authorization and audit.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/admin, features/manga, server/db

Inputs: editor identity, versioned metadata

Expected behavior:
Explicit publication state transition with optimistic concurrency and audit record.

Important edge cases: revoked role, stale edit, invalid rights state

Security: server role/resource check and CSRF

Testing: role matrix, integration/E2E

Manual QA: Unauthorized user denied; editor publishes.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-AUDIT-001 — Admin audit events

Requirements: FR-ADMIN-003, NFR-OBS-001

Goal: Record minimal append-only critical admin actions.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/admin, server/db

Inputs: actor/action/resource/outcome

Expected behavior:
Separate audit from diagnostic logs with access/retention.

Important edge cases: actor deleted, partial action

Security: tamper-resistant access controls

Testing: audit integration tests

Manual QA: Review publish/reject trail.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-07 Upload Pipeline

## T-UPLOAD-014 — Upload intake validation contract

Requirements: FR-UPLOAD-001, FR-UPLOAD-002, NFR-SEC-011

Goal: Validate bounded upload metadata and quarantine boundary.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/uploads, server/storage

Inputs: operator, file metadata/checksum

Expected behavior:
Reject oversize/unsupported input before costly processing; never publish directly.

Important edge cases: misleading MIME, duplicates, partial transfer

Security: scoped operator, quotas, random key

Testing: boundary and bypass tests

Manual QA: Operator sees explicit rejected status.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-UPLOAD-015 — Archive safety policy

Requirements: FR-UPLOAD-002, NFR-SEC-011

Goal: Implement safe archive inspection under hard resource limits.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/uploads, server/media

Inputs: quarantined archive

Expected behavior:
Reject traversal, symlinks, nested bomb and limits before extraction; isolate processor.

Important edge cases: Zip Slip, zip bombs, huge count

Security: sandbox and no public access

Testing: fuzz/corpus/resource exhaustion suite

Manual QA: Review quarantined/rejected outcomes.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-PROD-001 — Production backup and restore validation

Requirements: NFR-REL-001

Goal: Establish measured recovery before launch.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: deployment, runbooks

Inputs: managed DB/storage backup policy

Expected behavior:
Document RPO/RTO; execute isolated restore and integrity verification.

Important edge cases: partial restore, key loss, wrong region

Security: backup access separated/encrypted

Testing: restore drill evidence

Manual QA: Follow runbook in staging.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-08 Search

## T-SEARCH-001 — Bounded catalog search

Requirements: FR-SEARCH-001, FR-SEARCH-002

Goal: Search authorized published metadata with deterministic cursor.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/search, features/catalog, server/db

Inputs: bounded query/facets/cursor

Expected behavior:
Use PostgreSQL capabilities initially; establish perf corpus before alternate index.

Important edge cases: empty/long Unicode query, cursor stale

Security: rate limits, no raw query in logs

Testing: query security and latency tests

Manual QA: Search aliases and check hidden works stay hidden.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-09 Security

## T-SEC-001 — Security test gates

Requirements: NFR-SEC-001, NFR-SEC-011

Goal: Add automated security checks to CI.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: .github/workflows, tests

Inputs: dependency graph/source

Expected behavior:
Dependency/secret scanning and policy checks with actionable reporting.

Important edge cases: false positives, fork PR secrets

Security: least privilege, pinned actions

Testing: CI policy tests

Manual QA: Inspect failed finding workflow.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-RATE-001 — Abuse limits

Requirements: NFR-SEC-001

Goal: Protect public and privileged operations from abusive volume.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: server, edge

Inputs: route/account/IP budgets

Expected behavior:
Apply documented bounded limits and safe retry response.

Important edge cases: shared NAT, attacker rotation

Security: avoid account enumeration

Testing: 429 and load tests

Manual QA: Verify recovery after quota.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-10 Observability

## T-OBS-002 — Request trace and safe metric foundations

Requirements: NFR-OBS-001

Goal: Instrument request boundaries with safe correlation and low-cardinality metrics.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: server/telemetry

Inputs: request context

Expected behavior:
Propagate trace context and redact data; no application PII labels.

Important edge cases: missing trace, exporter outage

Security: redaction and no signed URLs

Testing: telemetry tests and log inspection

Manual QA: Trace a catalog request safely.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-11 Performance

## T-DEPLOY-002 — Staged deployment and rollback

Requirements: NFR-REL-001

Goal: Ship immutable artifact with readiness and rollback.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: deployment, CI

Inputs: artifact/config

Expected behavior:
Apply protected rollout and smoke verification.

Important edge cases: DB compatibility, health failure

Security: secret management and least privilege

Testing: deployment rehearsal

Manual QA: Rollback staging and verify.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.

## EPIC-12 Production

## T-ACCESS-001 — Reader accessibility validation

Requirements: NFR-A11Y-001

Goal: Verify controls with assistive technology.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: features/reader, tests/e2e

Inputs: reader modes and controls

Expected behavior:
Meet keyboard, focus, announcements, reduced motion and alternatives.

Important edge cases: virtualized focus, fullscreen exit

Security: no gesture-only action

Testing: axe + manual AT/device review

Manual QA: NVDA/VoiceOver and touch QA.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.
## T-MEDIA-001 — Authorized media delivery

Requirements: FR-READER-013, FR-UPLOAD-004

Goal: Deliver immutable approved derivatives privately.

Depends on: T-FOUND-001 (unless stated otherwise; confirm task graph before execution).

Expected modules: server/storage, server/media

Inputs: opaque asset identifier, entitlement

Expected behavior:
Issue controlled delivery without exposing credentials.

Important edge cases: expiry, CDN cache, withdrawn asset

Security: private origin and short TTL

Testing: policy integration tests

Manual QA: Test expired and unauthorized access.

Definition of Done: AGENTS.md. Implementation: NOT PART OF CURRENT PHASE.


Task overlap is intentional only where one item establishes a cross-cutting capability; dependencies must be made explicit before implementation. The first authorized implementation task is **T-FOUND-001 — Initialize strict application/tooling baseline**.
