/**
 * Event materials and links (upload, validation, serving policy).
 *
 * Where this belongs: features/content; validation is reused from features/media/validation (T-SEC-005).
 * Specification: CONTENT.md §6, TASKS.md T-CONTENT-003, THREAT_MODEL T-23.
 * Invariants: nothing user-supplied is rendered as HTML; materials are served from private storage with
 *   `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; outbound links are
 *   display-only (no open redirect, no shorteners, no tracking pixels, no hot-linked remote images -
 *   which is also required by the analytics prohibition, FR-ANALYTICS-004).
 * Task ownership: T-CONTENT-003, T-MOD-004.
 */
export interface Material {
  readonly materialId: string;
  readonly eventId: string;
  readonly kind: "FILE" | "LINK";
  readonly title: string;
  readonly sizeBytes?: number;
  readonly safeContentType?: string;
  readonly url?: string;              // display-only for LINK kind; validated host allow-list applies
}

/** @throws Error("Not implemented: T-CONTENT-003") */
export async function attachMaterial(input: { eventId: string; material: Omit<Material, "materialId">; actor: import("@/shared/contracts/permissions").Actor }): Promise<Material> {
  throw new Error("Not implemented: T-CONTENT-003");
}
