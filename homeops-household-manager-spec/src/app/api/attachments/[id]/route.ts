// HomeOps - route skeleton (specification phase). Handler shells only.

/**
 * GET /api/attachments/:id - serve a photo to a member of the owning household.
 *
 * Rules: authentication required; the owning entity's household scope is resolved first and a miss
 * returns 404 (never 403: existence is not confirmed); headers include Content-Disposition,
 * X-Content-Type-Options: nosniff, and a private cache directive; uploads are never served as HTML
 * or SVG; EXIF is stripped at ingest, not at serving (SECURITY.md section 9).
 *
 * Owning task: T-ISSUE-006.
 */
export async function GET(_request: Request, _context: { readonly params: Promise<{ readonly id: string }> }): Promise<Response> {
  throw new Error('Not implemented: T-ISSUE-006');
}
