# ADR-0012 — Mandatory human review before transcript publication

- Status: Accepted · Date: 2026-09-26 · Deciders: Product, AI/transcription architect, Security
- Requirements affected: FR-TRANSCRIPT-006/010, NFR-ETH-002 · Related: `docs/product/CONTENT-INTEGRITY.md`, ADR-0011, `TRANSCRIPTION.md`

## Context

Automatic transcription of a kajian produces text that **looks** authoritative. In this domain
that is dangerous: a mis-transcribed Qur'anic verse, a fabricated hadith attribution, a
distorted Arabic term, or a sentence whose negation is dropped changes religious meaning. The
audience may treat the transcript as a quotation of the speaker. A wrong transcript is not a
usability bug; it is a potential religious and reputational harm.

Meanwhile the material is the hardest possible case for ASR: Arabic script words embedded in
Bahasa Indonesia, Qur'anic recitation (often sung), classical Islamic terminology, proper nouns
of scholars and books, and code-switching mid-sentence.

## Decision

1. **Machine output is never published directly.** The pipeline enforces a gate:
   `PROCESSING → DRAFT → REVIEW_REQUIRED → APPROVED → PUBLISHED` (see `STATE_MACHINE.md`).
2. **Publication requires a named human approver** (`approved_by`, `approved_at`), recorded in
   the transcript and its revision history, and enforced by a database check constraint
   (`published_at IS NOT NULL ⇒ approved_by IS NOT NULL`).
3. **Provenance is explicit everywhere**: `source: MACHINE | HUMAN | MIXED`, a
   `review_status` field, and a user-visible label on every rendering
   ("Draf mesin — belum ditinjau" / "Ditinjau oleh <nama>, <tanggal>").
4. **Automation never "corrects" religious text.** No automatic Arabic normalisation, no
   auto-substitution of a familiar phrase for an uncertain one, no silent fixing of a hadith
   attribution. Automation may *flag* (low confidence, recitation detected, proper-noun
   candidate) and *never* rewrites. See `CONTENT-INTEGRITY.md` §Rules.
5. **Uncertainty is a first-class annotation** (`SegmentCertainty`: `UNVERIFIED` /
   `UNCERTAIN` / `VERIFIED`), preserved into the published artefact and displayed.
6. **Review is a workflow, not a formality**: audio-linked segments, timestamp navigation,
   revision history, conflict handling (optimistic locking), and a publishing gate that
   respects the event policy.
7. **The speaker can be the approver** for their own talk when the event policy grants it
   (`PUBLISH_AUDIO_AND_TRANSCRIPT`), because the speaker is the authority on their own words.

## Alternatives considered

- **Auto-publish with a disclaimer banner.** *Costs:* the banner is not a control; search
  engines and forwarders strip context; a wrong hadith attribution travels further than the
  disclaimer. *Rejected.*
- **Auto-publish but allow takedown.** *Costs:* harm occurs before the takedown; the platform
  becomes the publisher of record. *Rejected.*
- **"Confidence threshold" auto-approval (publish segments the model is sure about).**
  *Costs:* model confidence is poorly calibrated on code-switched religious text; a confident
  wrong quotation is the worst outcome. *Rejected.*
- **LLM-based auto-correction of Arabic and religious terms.** *Costs:* the model has no
  authority, will hallucinate canonical phrasing, and creates exactly the "silent correction"
  the requirements forbid. *Rejected* (may later *flag* candidates, never apply them —
  `CONTENT-INTEGRITY.md` §Assistive-only).
- **Transcription disabled entirely until review capacity exists.** *Kept as a legitimate
  deployment choice:* `transcriptionPolicy: NONE` remains the default for a mosque with no
  reviewer. The system never creates an unreviewable backlog by accident.

## Consequences

**Positive:** the archive contains only human-vouched text; the reviewer's identity and the
revision history make provenance defensible; participants can see certainty markers; the
platform cannot be accused of misquoting a speaker.

**Negative:** transcripts ship days later, not hours (`SUCCESS METRICS` M6 targets ≤ 7 days);
review is real human labour and the product must make it efficient (editor ergonomics,
segment-level review, keyboard shortcuts) or the queue will rot; transcription must be gated by
policy so we do not generate drafts nobody will review.

**Neutral:** machine drafts remain valuable — searchable internally, useful for chapter
sketching — but are labelled and never public.

## Enforcement

- Database: `CHECK (published_at IS NULL OR approved_by IS NOT NULL)` on `transcripts`, plus a
  state-machine transition table with no edge from `REVIEW_REQUIRED` to `PUBLISHED`.
- API: the publish endpoint requires `approvalRevisionId`; the service verifies the revision
  belongs to the transcript and that the actor is an authorised approver.
- UI: the label component renders provenance on every transcript surface; a Playwright test
  asserts the machine-draft label is present and that no publish control exists for a reviewer
  without the approval action.
- Tests: `describe.todo("does not publish machine transcript without configured review")`
  (`tests/unit/transcription/publish-gate.test.ts`).
- Review checklist: any PR touching transcription must state how the gate is preserved.

## Revisit trigger

**Never** for the core rule (this is an ethics/religious-integrity boundary, consistent with
`ADR-0024`'s "never" class). The *workflow shape* may be revisited: if human review capacity
becomes the bottleneck, the answer is better review tooling, delegation to the speaker, or
enabling transcription only for events with a committed reviewer — never auto-publication.
