/**
 * Transcript contracts.
 * Specification: TRANSCRIPTION.md, STATE_MACHINE.md §6/§7, ADR-0012 (human gate), ADR-0023 (append-only
 * revisions; machine draft is revision #1).
 * Invariants (non-negotiable, see docs/product/CONTENT-INTEGRITY.md):
 *   1. Machine output is stored verbatim and is immutable.
 *   2. Only a human revision can be approved; only an approved revision can be published.
 *   3. Uncertainty markers survive publication; no automatic correction of recitation or citations.
 *   4. Every save appends a revision (never overwrites) - optimistic concurrency via `version`.
 */
export type TranscriptState =
  | "NOT_REQUESTED" | "QUEUED" | "PROCESSING" | "DRAFT" | "REVIEW_REQUIRED"
  | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "FAILED";

export type SegmentKind = "SPEECH" | "RECITATION" | "QUOTE" | "NAME" | "NOISE" | "GAP";
export type Certainty = "CERTAIN" | "UNCERTAIN" | "UNINTELLIGIBLE";

export interface TranscriptSegment {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;              // verbatim for machine revisions
  readonly lang: string;              // BCP-47; "und" when unknown - never guessed silently
  readonly kind: SegmentKind;
  readonly certainty: Certainty;
  readonly citation?: { readonly work: string; readonly reference: string }; // reviewer-provided only
  readonly flags?: readonly string[];
}

export interface TranscriptRevision {
  readonly transcriptId: string;
  readonly revisionNumber: number;    // #1 = machine draft
  readonly authorKind: "MACHINE" | "HUMAN";
  readonly authorId?: string;         // required for HUMAN; absent for MACHINE
  readonly createdAt: string;
  readonly segments: readonly TranscriptSegment[];
}

export interface TranscriptProvenance {
  readonly providerId: string;
  readonly modelVersion: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly publishedRevisionNumber: number;
  readonly uncertaintyCount: number;
  readonly note?: string;
}
