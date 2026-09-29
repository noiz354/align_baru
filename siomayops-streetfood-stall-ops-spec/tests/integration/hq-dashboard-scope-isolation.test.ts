import { beforeEach, describe, expect, it } from "vitest";
import { authorizeHqScope, getHqDashboard, getHqOutletDetail, HqDashboardNotFoundError, type AuthorizedHqScope } from "@/features/hq/dashboard";
import type { SessionContext } from "@/server/auth/port";
import { memoryStore } from "@/server/db/memory-store";
import type { Scope } from "@/shared/types/scope";

/**
 * Scope enforcement and data-map conformance for the delivered HQ dashboard read model.
 *
 * These tests seed two organizations with identical shapes and assert that the read model
 * (and its drill-down) never aggregates across the tenant boundary, that unsupported or
 * incomplete scopes are denied instead of silently widening, and that the documented expense
 * rule of `docs/integration/01-dashboard-data-map.md` §3.4 is applied.
 */
const ORG_A = "org-a-isolation";
const ORG_B = "org-b-isolation";
const AREA_A1 = "area-a1";
const AREA_A2 = "area-a2";
const DAY = "2026-09-29";
const AT = new Date("2026-09-29T04:00:00.000Z");
const OWNER_ID = "user-owner-isolation";

function sessionFor(scope: Scope, roles: SessionContext["roles"], userId = OWNER_ID): SessionContext {
  return { organizationId: scope.organizationId, userId, roles, scope, sessionIssuedAt: AT };
}

function scopeFor(scope: Scope, roles: SessionContext["roles"] = ["OWNER"]): AuthorizedHqScope {
  return authorizeHqScope(sessionFor(scope, roles));
}

function seedLocation(org: string, id: string, name: string, areaId: string, status = "ACTIVE"): void {
  memoryStore.sellingLocations.set(id, { id, organizationId: org, areaId, name, status: status as never, createdAt: AT, updatedAt: AT });
}

function seedStall(org: string, id: string, areaId: string): void {
  memoryStore.stalls.set(id, { id, organizationId: org, areaId, code: `ST-${id}`, type: "MOBILE", status: "ACTIVE", createdAt: AT });
}

function seedShift(input: { org: string; id: string; locationId: string; operatorId: string; stallId: string; businessDay?: string; status?: string }): void {
  memoryStore.shifts.set(input.id, {
    id: input.id,
    organizationId: input.org,
    operatorId: input.operatorId,
    stallId: input.stallId,
    businessDay: input.businessDay ?? DAY,
    startedAt: AT,
    startLocationId: input.locationId,
    openingCashMinor: 50000,
    currency: "IDR",
    status: (input.status ?? "OPEN") as never,
    clientShiftId: `client-${input.id}`,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
  });
  memoryStore.locationReports.set(`report-${input.id}`, {
    id: `report-${input.id}`,
    organizationId: input.org,
    shiftId: input.id,
    stallId: input.stallId,
    operatorId: input.operatorId,
    sellingLocationId: input.locationId,
    trigger: "ARRIVED" as never,
    arrivedAt: AT,
    clientReportId: `client-report-${input.id}`,
    createdAt: AT,
  });
}

function seedSale(org: string, id: string, locationId: string, shiftId: string, totalMinor: number): void {
  memoryStore.sales.set(id, {
    id,
    organizationId: org,
    shiftId,
    sellingLocationId: locationId,
    operatorId: "op",
    stallId: "stall",
    businessDay: DAY,
    occurredAt: AT,
    serverAcceptedAt: AT,
    totalMinor,
    currency: "IDR",
    status: "COMPLETED",
    clientSaleId: `client-${id}`,
    version: 1,
    createdAt: AT,
  });
}

function seedExpense(org: string, id: string, shiftId: string, amountMinor: number, reviewStatus = "SUBMITTED"): void {
  memoryStore.expenses.set(id, {
    id,
    organizationId: org,
    shiftId,
    operatorId: "op",
    category: "PARKING",
    amountMinor,
    currency: "IDR",
    description: "parkir",
    paidFrom: "CASH_BOX",
    reviewStatus: reviewStatus as never,
    clientExpenseId: `client-${id}`,
    incurredAt: AT,
    createdAt: AT,
  });
}

/** Organization A (two areas, two outlets) and organization B (one outlet, larger money). */
function seedTwoOrganizations(): void {
  seedLocation(ORG_A, "loc-a1", "Outlet A1", AREA_A1);
  seedLocation(ORG_A, "loc-a2", "Outlet A2", AREA_A2);
  seedLocation(ORG_B, "loc-b1", "Outlet B1", "area-b");
  // The area filter of the delivered model resolves a shift's area through its stall record.
  seedStall(ORG_A, "stall-a1", AREA_A1);
  seedStall(ORG_A, "stall-a2", AREA_A2);
  seedStall(ORG_B, "stall-b1", "area-b");
  seedShift({ org: ORG_A, id: "shift-a1", locationId: "loc-a1", operatorId: "op-a1", stallId: "stall-a1" });
  seedShift({ org: ORG_A, id: "shift-a2", locationId: "loc-a2", operatorId: "op-a2", stallId: "stall-a2" });
  seedShift({ org: ORG_B, id: "shift-b1", locationId: "loc-b1", operatorId: "op-b1", stallId: "stall-b1" });
  seedSale(ORG_A, "sale-a1", "loc-a1", "shift-a1", 15000);
  seedSale(ORG_A, "sale-a2", "loc-a2", "shift-a2", 20000);
  seedSale(ORG_B, "sale-b1", "loc-b1", "shift-b1", 999000);
  seedExpense(ORG_A, "exp-a1", "shift-a1", 5000);
  seedExpense(ORG_A, "exp-a2", "shift-a2", 2000);
  seedExpense(ORG_B, "exp-b1", "shift-b1", 111000);
  memoryStore.auditEvents.push(
    { id: "audit-a1", organizationId: ORG_A, actorKind: "OPERATOR", actorId: "op-a1", action: "sale.created", entityType: "sale", entityId: "sale-a1", occurredAt: AT, requestId: "req-a1" },
    { id: "audit-b1", organizationId: ORG_B, actorKind: "OPERATOR", actorId: "op-b1", action: "sale.created", entityType: "sale", entityId: "sale-b1", occurredAt: AT, requestId: "req-b1" }
  );
}

describe("HQ dashboard scope isolation (delivered read model)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("keeps organization A blind to organization B outlets, money and activity", () => {
    seedTwoOrganizations();
    const model = getHqDashboard({ scope: scopeFor({ kind: "org", organizationId: ORG_A }), businessDay: DAY, limit: 50 });

    expect(model.kpis.salesMinor).toBe(35000);
    expect(model.kpis.expensesMinor).toBe(7000);
    expect(model.kpis.totalOutlets).toBe(2);
    expect(model.outlets.map((row) => row.id).sort()).toEqual(["loc-a1", "loc-a2"]);
    expect(model.outletOptions.map((row) => row.id).sort()).toEqual(["loc-a1", "loc-a2"]);
    expect(model.activity.map((row) => row.id)).not.toContain("audit-b1");
    expect(JSON.stringify(model)).not.toContain("loc-b1");
    expect(JSON.stringify(model)).not.toContain("999000");
  });

  it("keeps organization B blind to organization A records (both directions)", () => {
    seedTwoOrganizations();
    const model = getHqDashboard({ scope: scopeFor({ kind: "org", organizationId: ORG_B }), businessDay: DAY, limit: 50 });

    expect(model.kpis.salesMinor).toBe(999000);
    expect(model.outlets.map((row) => row.id)).toEqual(["loc-b1"]);
    expect(JSON.stringify(model)).not.toContain("loc-a1");
    expect(JSON.stringify(model)).not.toContain("15000");
  });

  it("narrows an area supervisor to their area for KPIs, outlet rows and drill-down", () => {
    seedTwoOrganizations();
    const areaScope = scopeFor({ kind: "area", organizationId: ORG_A, areaId: AREA_A1 }, ["AREA_SUPERVISOR"]);
    const model = getHqDashboard({ scope: areaScope, businessDay: DAY, limit: 50 });

    expect(model.kpis.salesMinor).toBe(15000);
    expect(model.kpis.expensesMinor).toBe(5000);
    expect(model.outlets.map((row) => row.id)).toEqual(["loc-a1"]);
    expect(model.outletOptions.map((row) => row.id)).toEqual(["loc-a1"]);
    // Area-2 outlet: NOT_FOUND rather than a silent empty page.
    expect(() => getHqDashboard({ scope: areaScope, businessDay: DAY, outletId: "loc-a2" })).toThrow(HqDashboardNotFoundError);
    expect(() => getHqOutletDetail({ scope: areaScope, businessDay: DAY, outletId: "loc-a2" })).toThrow(HqDashboardNotFoundError);
  });

  it("does not reveal another tenant's outlet through the drill-down either", () => {
    seedTwoOrganizations();
    const orgScopeA = scopeFor({ kind: "org", organizationId: ORG_A });
    expect(() => getHqDashboard({ scope: orgScopeA, businessDay: DAY, outletId: "loc-b1" })).toThrow(HqDashboardNotFoundError);
    expect(() => getHqOutletDetail({ scope: orgScopeA, businessDay: DAY, outletId: "loc-b1" })).toThrow(HqDashboardNotFoundError);
  });

  it("denies roles without HQ read access, and denies unresolvable scopes instead of widening them", () => {
    seedTwoOrganizations();
    const operatorSession = sessionFor({ kind: "self", organizationId: ORG_A, operatorId: "op-a1" }, ["OPERATOR"], "user-op");
    expect(() => authorizeHqScope(operatorSession)).toThrow(/Forbidden|forbidden/);

    // region has no persisted data and an incomplete area/stall scope cannot be resolved:
    // both must fail closed rather than fall back to the whole organization.
    expect(() => authorizeHqScope(sessionFor({ kind: "region", organizationId: ORG_A, regionId: "region-1" }, ["OWNER"]))).toThrow();
    expect(() => authorizeHqScope(sessionFor({ kind: "area", organizationId: ORG_A }, ["AREA_SUPERVISOR"]))).toThrow();
    expect(() => authorizeHqScope(sessionFor({ kind: "stall", organizationId: ORG_A }, ["OWNER"]))).toThrow();
  });

  it("denies a session whose scope belongs to another organization", () => {
    seedTwoOrganizations();
    const tampered: SessionContext = {
      organizationId: ORG_A,
      userId: "user-tampered",
      roles: ["OWNER"],
      scope: { kind: "org", organizationId: ORG_B },
      sessionIssuedAt: AT,
    };
    expect(() => authorizeHqScope(tampered)).toThrow();
  });

  it("applies the data-map expense rule: rejected expenses are excluded from the day total", () => {
    seedTwoOrganizations();
    seedExpense(ORG_A, "exp-a1-rejected", "shift-a1", 250000, "REJECTED");
    seedExpense(ORG_A, "exp-a1-escalated", "shift-a1", 3000, "ESCALATED");

    const model = getHqDashboard({ scope: scopeFor({ kind: "org", organizationId: ORG_A }), businessDay: DAY, limit: 50 });
    const outletA1 = model.outlets.find((row) => row.id === "loc-a1");

    expect(model.kpis.expensesMinor).toBe(10000); // 5000 + 2000 + 3000 escalated, rejected excluded
    expect(outletA1?.expensesMinor).toBe(8000); // 5000 + 3000 escalated for this outlet
  });
});
