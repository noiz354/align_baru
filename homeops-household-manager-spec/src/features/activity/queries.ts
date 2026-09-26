// HomeOps - feature skeleton (specification phase). Read-model contract only.

/** Keyset-paginated feed (never infinite scroll - people lose their place, INTERACTION-PATTERNS section 14). */
export type ActivityFeedPage = {
  readonly items: readonly {
    readonly id: string;
    readonly type: string;
    readonly summary: string;
    readonly occurredAt: string;
    readonly actorDisplayName?: string;
    readonly entity: { readonly kind: string; readonly id: string };
  }[];
  readonly nextCursor?: string;
};

/**
 * Load a page of activity for a household (FR-ACT-003). Filters: type, member, room,
 * date range (max 180 days). Actions only - the absence of view/presence types is the product
 * promise, and a test asserts no per-member counting read model exists (T-ACT-006).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ACT-003 - requirements, ADR, design, and tests are listed there.
 */
export async function loadActivityPage(): Promise<ActivityFeedPage> {
  throw new Error('Not implemented: T-ACT-003');
}
