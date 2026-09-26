/**
 * POST /api/chapters/{chapterId}/progress — API route shell.
 *
 * Requirement: FR-READER-014. Task: T-READER-022.
 * Body → contract: API_CONTRACT §2.4 (page, chapter, ts) →
 * 201 created | 200 updated. Anonymous ⇒ AUTH_REQUIRED (401).
 * The service owns monotonicity + same-millisecond ordering (INV).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-READER-022');
}
