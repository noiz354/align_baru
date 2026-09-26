/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Authorization scope (ADR-0016, ADR-0031). Every repository method requires an explicit scope,
 * so an unscoped data access cannot be written by accident (INV-10, INV-11).
 */
export type ScopeKind = "org" | "region" | "area" | "stall" | "self";

export interface Scope {
  readonly kind: ScopeKind;
  readonly organizationId: import("./ids").OrganizationId;
  readonly regionId?: import("./ids").RegionId;
  readonly areaId?: import("./ids").AreaId;
  readonly stallId?: import("./ids").StallId;
  readonly operatorId?: import("./ids").OperatorId;
}
