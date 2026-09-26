/**
 * Data exports (attendance, audit) - generated on demand, private, short-lived, audited.
 *
 * Where this belongs: features/exports.
 * Specification: TASKS.md T-OPS-006, ATTENDANCE.md §5, RETENTION.md (exports 7 days), THREAT_MODEL T-22.
 * Invariants: the export contains at most what the requester can already read in the UI (no
 *   "export reveals more"); contact fields require an explicit selection, the permission and a reason,
 *   all recorded; files land in a private bucket with a short signed URL; deletion after 7 days is
 *   verified by a job; concurrent requests are coalesced so partial files are never distributed.
 * Task ownership: T-ATTEND-005, T-OPS-006.
 */
export interface ExportRequest {
  readonly kind: "ATTENDANCE" | "AUDIT";
  readonly organizationId: string;
  readonly eventId?: string;
  readonly fields: readonly string[];
  readonly reason?: string;
  readonly actor: import("@/shared/contracts/permissions").Actor;
}

/** @throws Error("Not implemented: T-OPS-006") */
export async function createExport(request: ExportRequest): Promise<{ exportId: string; status: "QUEUED" | "COALESCED" }> {
  throw new Error("Not implemented: T-OPS-006");
}
