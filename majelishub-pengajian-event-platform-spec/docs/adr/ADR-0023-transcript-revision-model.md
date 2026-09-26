# ADR-0023 — Append-only transcript revisions and immutable published snapshots

- Status: Accepted · Date: 2026-09-26 · Deciders: Domain architect, Content integrity, Security
- Requirements affected: FR-TRANSCRIPT-007/009/010/012/015 · Related: ADR-0012, `TRANSCRIPTION.md`, `DATA_MODEL.md`

## Context

A transcript is corrected by humans over time: the first reviewer fixes obvious ASR errors, the
speaker corrects a name, a later pass adds Arabic diacritics. In religious content, "what
exactly was published, by whom, and when" must be answerable — a published transcript is a
quotable artefact and may be contested.

Two naive designs fail:

- **Mutable document:** every save overwrites text. You cannot tell who introduced a change, and
  an accidental edit is unrecoverable. Publication is also retroactively mutable — the worst
  case for a quotable text.
- **Version-per-edit with no publication snapshot:** the "published" page shows whatever the
  latest revision says, so the artefact changes silently after publication.

## Decision

1. **Segments are the unit of editing.** A transcript is an ordered list of `TranscriptSegment`
   rows (start/end ms, text, speaker label, certainty, kind, flags).
2. **Every save writes an immutable `TranscriptRevision`** containing a snapshot of the full
   segment set (or a diff plus a monotonically increasing `revision_number`), the author, the
   timestamp, and a note. Revisions are never updated or deleted (except by retention policy on
   non-published, abandoned drafts — see `RETENTION.md` §Transcript revisions).
3. **Optimistic concurrency:** each transcript carries `version`. A save submits the version it
   started from; mismatch = `409 CONFLICT` with a diff. No last-write-wins, ever
   (`CONCURRENCY` C6).
4. **Approval pins a revision:** `transcripts.approved_revision_id`. Publication publishes
   **that revision** as an immutable snapshot (`published_revision_id`); the public page serves
   the snapshot, not "current".
5. **Post-publication changes create a new revision and require re-approval** before the change
   becomes visible. Unpublishing preserves all revisions with a reason
   (`FR-TRANSCRIPT-012`).
6. **Provenance is stored per revision** (`source: MACHINE | HUMAN | MIXED`, `approved_by`,
   `approved_at`), and the machine draft is retained as revision #1 (so "what the model
   produced" remains auditable — essential for evaluating provider quality and for defending
   against a claim that we altered a speaker's words).
7. **Certainty flags live on segments and persist into the snapshot**, so a published transcript
   can display "bagian ini ditandai ragu oleh peninjau" indefinitely.

## Alternatives considered

- **Mutable transcript with an audit log.** *Gains:* simple schema; small storage. *Costs:*
  reconstruction of a past state requires replaying logs; publication is not pinned; diffs are
  an afterthought. *Rejected.*
- **Event sourcing the whole transcript.** *Gains:* perfect history. *Costs:* high complexity
  for a document-like object; the snapshot model already answers every question we can pose.
  *Rejected* as over-engineering (the revisions table *is* the event log, scoped).
- **Git-style content-addressed storage of text.** *Gains:* dedup, real diffs. *Costs:* another
  storage system and toolchain; diffs are computable from snapshots anyway. *Rejected.*
- **Store only the latest revision plus a "last edited by" field.** *Rejected:* fails the
  integrity requirement outright.
- **One transcript per event with segments replaced in place and a soft-delete history table
  built from triggers.** *Costs:* business semantics hidden in triggers; hard to test; and it
  makes the approval/publication pins awkward. *Rejected.*

## Consequences

**Positive:** any published text is reproducible exactly; reviewers can be held accountable
fairly; conflicts are detectable rather than destructive; provider output remains auditable; an
accidental bad edit is recoverable by reverting to a prior revision (which itself is a new
revision — see below).

**Negative:** storage grows with revisions (a 60-minute transcript is ~40–80 KB of text; a few
hundred revisions per transcript is still trivial); the UI must present revision history without
overwhelming reviewers; reverting is a new revision, so the history is a DAG of intent rather
than a linear undo.

**Neutral:** revisions are written inside the same transaction as segment updates, so no torn
state is visible.

## Enforcement

- DB: `transcript_revisions` has no `UPDATE`/`DELETE` path in application code; a test asserts
  an attempted update fails (permissions/trigger) and that revision numbers are strictly
  increasing per transcript.
- DB check: `published_revision_id IS NOT NULL ⇒ approved_revision_id = published_revision_id`
  and `approved_by IS NOT NULL` (see ADR-0012).
- A concurrency test simulates two reviewers saving from the same base version and asserts one
  succeeds and the other receives a conflict — with no data loss.
- The public transcript endpoint must serve `published_revision_id` content; a test asserts that
  editing after publication does not change the public output until re-approval.

## Revisit trigger

Reopen if: revision volume becomes storage-significant (> 5% of total storage), or reviewers
report that history is unusable — the response is compaction of *intermediate machine* revisions
only, never of published or approved snapshots.
