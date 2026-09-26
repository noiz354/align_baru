/**
 * Public projections for published content (the ONLY shapes a public page may read).
 *
 * Where this belongs: features/content. Public pages must never read domain rows directly, because a
 * projection is where the publication gate, the policy and the withholding rules are applied once.
 * Specification: CONTENT.md §5, ADR-0012, TASK T-TRANSCRIPT-012, docs/product/CONTENT-INTEGRITY.md §3.
 * Invariants: only APPROVED/PUBLISHED revisions appear; UNPUBLISHED or INTERNAL items are absent (404
 *   with a neutral explanation page); the provenance block (reviewer, date, revision, uncertainty
 *   count) is part of the projection; no counts, ratings or rankings of any kind are included
 *   (ADR-0014/0024); search indexes only this projection (fail closed: missing is acceptable,
 *   exposing is not).
 * Privacy: unpublished transcripts may contain unverified personal details - they must never leak
 *   through a projection, a cache or a search index.
 * Task ownership: T-CONTENT-001/002/006, T-TRANSCRIPT-011/013.
 */
import type { TranscriptProvenance, TranscriptSegment } from "@/shared/contracts/transcript";

export interface PublicTranscriptProjection {
  readonly transcriptId: string;
  readonly eventId: string;
  readonly eventTitle: string;
  readonly mosqueName: string;
  readonly speakerDisplayName?: string;
  readonly startsAt: string;
  readonly segments: readonly TranscriptSegment[];
  readonly provenance: TranscriptProvenance;
  readonly hasAudio: boolean;
  readonly uncertaintyCount: number;
}

/** @throws Error("Not implemented: T-CONTENT-002") */
export async function loadPublicTranscript(input: { transcriptId: string }): Promise<PublicTranscriptProjection | null> {
  throw new Error("Not implemented: T-CONTENT-002");
}
