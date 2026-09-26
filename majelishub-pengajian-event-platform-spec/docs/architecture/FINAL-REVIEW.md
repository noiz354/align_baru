# FINAL ARCHITECTURE REVIEW — PHASE 0

Scope: this document responds to the challenges a reviewer should raise against the design. It states
the position taken, the mechanism that backs it, and the residual risk. It is written to be **falsified**
— if an answer here is wrong, the fix belongs in the named document, not in this file.

Reviewed artefacts: `PRD.md` (229 requirements), `ARCHITECTURE.md` (18 modules), `DOMAIN.md`,
`DATA_MODEL.md` (§11 = 14 constraint invariants), `API.md`, `EVENTS.md`, `STATE_MACHINE.md` (10
machines), `DESIGN.md`, 27 ADRs, `THREAT_MODEL.md` (T-01…T-24), `PRIVACY.md`/`RETENTION.md` (R1…R28),
`PERFORMANCE.md` (P1…P40), `OBSERVABILITY.md` (metric catalogue + 20 alerts), `TASKS.md` (147 task IDs).

---

## 1. Core product questions

| # | Question | Answer, with the mechanism |
|---|---|---|
| 1 | How does someone find a kajian? | Chronological discovery list + filters (mosque, area, topic, speaker, accessibility, language); never ranked by popularity. Programs are grouped with the next occurrence first (`docs/product/EVENTS.md` §6). |
| 2 | How do they register in seconds? | Minimal-field form (name + one contact + optional count/accessibility need); no account required for `OPEN`/`CAPACITY_LIMITED`; idempotent submission; result page carries the code (`REGISTRATION.md`). |
| 3 | How do they get a code that is safe to hold? | Opaque 128-bit token (`MAJ-XXXX-…`), hashed at rest, no PII and no entity ids; printable and cached for offline display (ADR-0006, `docs/security/QR-SECURITY.md`). |
| 4 | What if they cannot scan? | Short code, name lookup with confirm-before-commit, and a paper fallback with audited bulk entry — the QR is never the only mechanism (ADR-0026, `docs/attendance/OFFLINE-EVALUATION.md`). |
| 5 | Does check-in ever lie? | No. Success requires a committed row (durable storage + DB); timeouts are "belum tercatat"; database errors are `UNAVAILABLE`; the UI has no success shape it cannot prove (`CHECKIN.md`, `docs/architecture/FAILURE-MODEL.md` §2). |
| 6 | Can two scanners create two records? | No: `UNIQUE (event_id, registration_id)` + `INSERT … ON CONFLICT DO NOTHING RETURNING`; the loser gets `ALREADY_CHECKED_IN` with the original time (C2, ADR-0025). |
| 7 | Are the attendance numbers honest? | Registered / checked-in / walk-in / no-show are distinct; no stored counters (derived, reconciled hourly); no fake precision; manual-share and correction counts are shown as data quality (`ATTENDANCE.md`). |
| 8 | Can a 2-hour recording survive reality? | 10 s chunks (5–30 s), IndexedDB-first queue, `acceptedUpTo` reconciliation, gap manifests, idempotent chunk ids, recovery after reload; partial recordings are labelled partial (ADR-0008, `docs/media/CHUNK-PROTOCOL.md`). |
| 9 | Is the audio usable later? | Server-side container-aware assembly into a seekable master, −16 LUFS normalisation, 16 kHz derivative for ASR; the master is the irreplaceable artefact and is never deleted by normal operation (ADR-0009). |
| 10 | How is a transcript created? | Asynchronous, provider-abstracted job (`TranscriptionProvider`), self-hosted Whisper large-v3 by default, egress off by default; provider output is stored verbatim as revision #1 (ADR-0011, `docs/transcription/PIPELINE.md`). |
| 11 | How is it made trustworthy? | Mandatory human review, blocking flags, append-only revisions with per-segment diffs, approval binds a revision, DB CHECK enforces `published_at ⇒ approved_by`, published page shows reviewer/date/revision/uncertainty (ADR-0012/0023, `docs/product/CONTENT-INTEGRITY.md`). |
| 12 | What about Arabic and code-switching? | Structural handling: `kind`/`lang` per segment, script detection, `POSSIBLE_RECITATION` flags, gap-aware segmentation, **no automatic correction or translation, ever**; the honest limitation is stated publicly (`docs/transcription/CODE-SWITCHING.md`). |
| 13 | How does feedback improve things without harming people? | Six dimensions at the organizer level only, small-sample suppression (n < 5), anonymity enforced by a DB CHECK, no speaker-quality dimension, nothing public, raw → aggregates after 12 months (ADR-0016, `FEEDBACK.md`). |
| 14 | Who is told what, and how? | A ~23-key notification catalogue with classes (essential/optional/operational), dedupe keys, quiet hours, in-app + email only in the MVP, and a hard rule that check-in tokens never travel through uncontrolled channels (`NOTIFICATIONS.md`). |

## 2. Hard challenges

### 2.1 "Isn't a modular monolith just a monolith you regret later?"
The boundaries are enforced mechanically (`T-ARCH-002`), the import direction is fixed
(`app → features → domain → shared/server`), and the extraction candidates are named in
`ARCHITECTURE.md` (media processing, transcription orchestration, notifications). Extraction is possible
because every cross-boundary call already goes through a port. The alternative (services from day one)
was rejected for operational reasons: the target is one volunteer, not a platform team (ADR-0002).

### 2.2 "Domain events without a broker — how do you know nothing is lost?"
Events are written to an outbox **in the same transaction** as the state change and dispatched by a
job; consumers are idempotent by `dedupe_key` (ADR-0010/0015, `EVENTS.md` §3). Kafka/BullMQ/Redis were
rejected explicitly (ADR-0010); pg-boss provides retries, DLQ, cron and `sendOnce` on infrastructure we
already operate. The failure mode to watch is outbox growth — handled by purge hygiene and a backlog
alert.

### 2.3 "The entrance is the moment of truth — what happens when the network dies?"
Manual path + paper fallback, with a documented procedure and an alert (`RB-01`), plus a deliberate
decision not to build offline synchronisation yet (ADR-0007) and stated revisit triggers. The trade-off
is honest: the system prefers "not recorded yet" over "possibly recorded twice".

### 2.4 "Can a mosque administrator build a profile of a person across events?"
No. There is no participant entity, no cross-event identity, and no analytics at participant level;
aggregates require n ≥ 5 and are aggregate-only (`PRIVACY.md` §6, `DOMAIN.md`, ADR-0016). This is a
deliberate product limitation: it is what makes the product safe to use.

### 2.5 "How do you stop a careless publisher from leaking unreviewed text?"
Four independent layers: domain transitions, service logic, API surface, and a database CHECK constraint;
each is tested separately, and a QA scenario attempts the bypass deliberately
(`tests/integration/transcription/publish-gate.test.ts`, QA-05).

### 2.6 "What if a hosted speech provider is used with no decision?"
It cannot happen by accident: egress is off by default, the adapter refuses to construct, the processor
table and enabled adapters are compared at boot, and a new processor requires an ADR (`T-TRANSCRIPT-005`,
`PRIVACY.md` §5).

### 2.7 "Is the design materially simpler than the problem?"
Yes, in three places where complexity was cut deliberately: no participant accounts (registration is
lightweight), no offline sync engine, no message broker. Each removal is documented with its cost, and
each has a revisit trigger.

### 2.8 "Is it accessible for the people who actually attend?"
WCAG 2.2 AA targets, 56 px touch targets, short-code targets ≥ 32 px with large-text mode, triple-channel
check-in feedback (visual/text/sound), PII-free live regions, mandatory non-camera and non-microphone
fallbacks, and per-release manual screen-reader passes (`ACCESSIBILITY.md`).

### 2.9 "What about legal exposure (UU PDP)?"
Data minimisation, purpose statements in an inventory, aggregate-only analytics, a processor table,
72-hour breach procedure, DSR workflows with SLAs, retention per data class with dry-run-first jobs and
evidence records (counts only), and an audit trail retained 7 years (`PRIVACY.md`, `RETENTION.md`,
`docs/security/INCIDENT-RESPONSE.md`). The Oct-2026 transition deadline is treated as already in force.

### 2.10 "Will this still be maintainable in two years by one person?"
That is the design constraint. Evidence: one Postgres, one object store, three containers, no broker, no
cache server; migrations are explicit and forward-only; alerts are ~20 and each has a runbook section;
the tests are layered so a change can be verified without a full environment; and documentation is the
authoritative artefact with a lint gate (`T-DOCS-001`).

## 3. Residual risks we accept (with the reason)

| Accepted risk | Why accepted | Mitigation |
|---|---|---|
| A signed URL is valid until expiry (≤ 15 min) after access is revoked | Unavoidable with object storage signing | Short TTLs, permission flip blocks new URLs, withdrawal is immediate for new requests |
| A forwarded QR screenshot lets someone appear at the door once | Identity at the door is a people problem, not a software one | One record per registration, duplicate metrics, rotation on demand, honest organizer guidance |
| Volunteer devices are unmanaged | The alternative (device management) exceeds the deployment's capacity | Device binding, narrow scope, idle timeout, revocation, full attribution |
| Hosted STT, if enabled, receives audio | Disabled by default; a decision is required | Egress control, processor documentation, allow-listed egress, decision record |
| Shared phones mean identity is approximate | Common reality in the target context | Registration is a code to a person, not an account; no participant-level analytics exist to be wrong about |
| Self-hosted Whisper on CPU is slow | Cost vs latency trade-off | Batch pattern, GPU option documented, provider port for those who fund a hosted service |

## 4. What would make us change the design (falsifiers)

1. **Repeated connectivity incidents** → build offline intents (ADR-0007 triggers).
2. **Check-in p95 > 300 ms at target load with healthy infrastructure** → the current model (direct DB
   write per check-in) is wrong; revisit with a queued write and an immediate local confirmation — but
   only if the honesty rules can still be preserved.
3. **Chunk upload failures from a specific venue pattern** → revisit capture (longer chunks, different
   codec, AudioWorklet/PCM path per ADR-0008's trigger).
4. **Transcript review throughput collapsing** (review backlog > 7 days systematically) → improve review
   tooling (better alignment, keyboard-first editing), never relax the gate.
5. **Single-tenant deployment demand** (a mosque wanting its own instance) → affects operations, not the
   domain model; the schema already isolates by organization.
6. **A legal or scholarly requirement for citation formatting** → extend the citation model, not the
   freedom to edit text.

## 5. Verdict

The design is **coherent, minimal and honest about its limits**. It is not the cheapest way to build a
registration form, and it is deliberately not a social platform. Every place where the product could
mislead — attendance counts, machine text, popularity, offline success — has a mechanism preventing it,
a test naming it, and a document stating the trade-off.

Phase 0 can close when the exit criteria in `ROADMAP.md` (VS-0) are met: traceability complete,
typecheck green on the skeleton, every stub throwing `Not implemented: <task>`, all tests `todo`,
and a reviewer able to explain the check-in path and the publication gate after reading `README.md`,
`ARCHITECTURE.md` and two ADRs.
