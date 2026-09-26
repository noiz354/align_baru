// HomeOps — skeleton (specification phase). Contracts only.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

/**
 * Reusable Zod primitives so validation rules are stated once (docs/api/CONVENTIONS.md §6).
 * Shape validation happens here; business rules belong to the aggregate, not to a schema.
 * Implemented alongside T-PLAT-007 (Zod 4, SELECTED in docs/research/STACK-2026.md).
 */
export const LIMITS = {
  householdName: { min: 1, max: 40 },
  roomName: { min: 1, max: 40 },
  choreTitle: { min: 1, max: 80 },
  resourceName: { min: 1, max: 60 },
  assetName: { min: 1, max: 60 },
  issueTitle: { min: 1, max: 120 },
  note: { max: 500 },
  commentBody: { min: 1, max: 1000 },
  reason: { max: 140 },
  photoBytes: 5 * 1024 * 1024,
  photosPerIssue: 5,
  softCapRooms: 50,
  softCapResources: 120,
  softCapAssets: 60,
  softCapContainers: 10,
} as const;

/** TODO(T-PLAT-007): createZodSchemas — trims, rejects control characters, validates IANA timezones. */
export function createValidationPrimitives(): never {
  throw new Error('Not implemented: T-PLAT-007');
}
