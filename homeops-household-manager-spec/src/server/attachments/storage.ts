// HomeOps - server skeleton (specification phase). Adapter contract only.

/**
 * Attachment storage (SECURITY.md section 9, proposed ADR-017).
 *
 * Contract:
 *  - allow-list: image/jpeg, image/png, image/webp; <= 5 MB; <= 5 per issue;
 *  - content is sniffed, never trusted from the extension;
 *  - EXIF (including GPS) is stripped on ingest;
 *  - storage keys are server-generated; files are stored outside the web root;
 *  - serving is authenticated and household-scoped, with Content-Disposition and nosniff;
 *  - soft delete with a 30-day purge; the storage backend is chosen by ADR-017 at VS-11.
 *
 * Status: unimplemented by design. Owning task: T-ISSUE-006.
 */
export type StoredAttachment = {
  readonly id: string;
  readonly storageKey: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly bytes: number;
  readonly sha256: string;
};

export async function storeAttachment(_input: {
  readonly householdId: string;
  readonly bytes: Uint8Array;
  readonly declaredMimeType: string;
}): Promise<{ readonly ok: true; readonly attachment: StoredAttachment } | { readonly ok: false; readonly code: 'ATTACHMENT_REJECTED' }> {
  throw new Error('Not implemented: T-ISSUE-006');
}
