import { opsMapFixture } from "./fixture";
import type { OpsMapReadModel } from "./types";

export type * from "./types";

export interface OpsMapReadModelResult {
  readonly data: OpsMapReadModel;
  readonly meta: {
    readonly computedAt: string;
    readonly freshnessBand: "current" | "recent" | "stale";
    /** Honest provenance: the pilot serves a deterministic fixture (T-LOC-002 / T-HQ-001 pending). */
    readonly source: "fixture" | "read-model";
  };
}

/**
 * Read model for HQ › Operasional › Peta Live. Scoped per organisation by the caller
 * (docs/security/PERMISSIONS.md — `hq:view`). Returns only stall-level, shift-bound,
 * operator-reported positions (ADR-0007); nothing here is derived from background telemetry.
 */
export async function getOpsMapReadModel(_organizationId: string): Promise<OpsMapReadModelResult> {
  return {
    data: opsMapFixture,
    meta: { computedAt: opsMapFixture.computedAt, freshnessBand: "current", source: "fixture" },
  };
}
