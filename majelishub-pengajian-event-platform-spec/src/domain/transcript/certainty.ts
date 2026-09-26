/**
 * Certainty, citation and provenance rules (pure).
 *
 * Where this belongs: `src/domain/transcript/` - the invariants here are the product's integrity
 * promise and must not depend on any layer above them.
 * Specification: docs/transcription/CODE-SWITCHING.md §4, docs/product/CONTENT-INTEGRITY.md §2,
 *   TRANSCRIPTION.md, ADR-0023 (append-only revisions).
 *
 * Invariants (hard rules, enforced by tests, not by convention):
 *   1. No automation may write to a stored segment. Only a human-authored revision changes text.
 *   2. `RECITATION` segments are never altered by any automated step (no auto-correction, no
 *      canonical-verse substitution, no translation).
 *   3. Uncertainty markers survive approval and publication unchanged.
 *   4. Citations are reviewer-provided only; the system never attaches a verse reference on its own.
 *   5. The machine draft (revision #1) is immutable and always retrievable for audit.
 * Task ownership: T-TRANSCRIPT-014.
 */
import type { Certainty, SegmentKind, TranscriptSegment } from "@/shared/contracts/transcript";

export interface RevisionGuardInput {
  readonly fromRevisionNumber: number;
  readonly authorKind: "MACHINE" | "HUMAN";
  readonly segments: readonly TranscriptSegment[];
}

export interface RevisionGuard {
  /** Reject any machine-authored change to a stored segment (rule 1/2). */
  assertMachineCannotEdit(input: RevisionGuardInput): void;
  /** Uncertain/unintelligible markers must be present in the published revision (rule 3). */
  assertMarkersPreserved(previous: readonly TranscriptSegment[], next: readonly TranscriptSegment[]): void;
  /** Only reviewer-provided citations may exist (rule 4). */
  assertCitationsReviewerProvided(segment: TranscriptSegment, providedByKind: "MACHINE" | "HUMAN"): void;
  /** Rendering hint: Arabic-script segments must be rendered with lang/dir, never transliterated. */
  classifyRendering(text: string, kind: SegmentKind): { lang: string | "und"; dir: "rtl" | "ltr" };
  markCertainty(segmentId: string, certainty: Certainty, reason: string): void;
}

/**
 * @throws Error("Not implemented: T-TRANSCRIPT-014") - the guards land with the review editor, and
 * their tests (tests/unit/transcript/no-autocorrect.test.ts) must fail first.
 */
export function revisionGuard(): RevisionGuard {
  throw new Error("Not implemented: T-TRANSCRIPT-014");
}
