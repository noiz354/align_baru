import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionContext } from "@/server/auth/port";
import { listExpenses, getExpense } from "@/features/expenses/read-model";
import { memoryStore } from "@/server/db/memory-store";

const orgId = "00000000-0000-7000-0000-000000000001";
const otherOrgId = "00000000-0000-7000-0000-000000000099";
const ownOperator = "00000000-0000-7000-0000-000000000010";
const otherOperator = "00000000-0000-7000-0000-000000000011";
const ownStall = "00000000-0000-7000-0000-000000000020";
const otherStall = "00000000-0000-7000-0000-000000000021";
const ownShift = "00000000-0000-7000-0000-000000000030";
const otherShift = "00000000-0000-7000-0000-000000000031";

function session(scope: SessionContext["scope"]): SessionContext {
  return { organizationId: orgId, userId: "00000000-0000-7000-0000-000000000002", operatorId: ownOperator, roles: ["OPERATOR"], scope, sessionIssuedAt: new Date() };
}
function addStall(id: string, organizationId = orgId, areaId = "area-a") {
  memoryStore.stalls.set(id, { id, organizationId, areaId, code: `OUT-${id.slice(-2)}`, type: "CART", status: "ACTIVE", createdAt: new Date() });
}
function addShift(id: string, stallId: string, operatorId: string, organizationId = orgId) {
  memoryStore.shifts.set(id, { id, organizationId, operatorId, stallId, businessDay: "2026-09-30", startedAt: new Date(), startLocationId: "location", openingCashMinor: 50000, currency: "IDR", status: "OPEN", clientShiftId: `client-${id}`, version: 1, createdAt: new Date(), updatedAt: new Date() });
}
function addExpense(id: string, shiftId: string, operatorId: string, organizationId = orgId) {
  memoryStore.expenses.set(id, { id, organizationId, shiftId, operatorId, category: "TRANSPORT", amountMinor: 25000, currency: "IDR", description: "", paidFrom: "CASH_BOX", reviewStatus: "SUBMITTED", clientExpenseId: `client-${id}`, incurredAt: new Date(), createdAt: new Date() });
}

describe("expense read model scope", () => {
  beforeEach(() => {
    memoryStore.clear();
    addStall(ownStall);
    addStall(otherStall, orgId, "area-b");
    addStall("foreign-stall", otherOrgId, "area-a");
    addShift(ownShift, ownStall, ownOperator);
    addShift(otherShift, otherStall, otherOperator);
    addShift("foreign-shift", "foreign-stall", otherOperator, otherOrgId);
    addExpense("expense-own", ownShift, ownOperator);
    addExpense("expense-other-operator", otherShift, otherOperator);
    addExpense("expense-foreign", "foreign-shift", otherOperator, otherOrgId);
  });
  afterEach(() => memoryStore.clear());

  it("limits self scope to expenses on the operator's own shift", () => {
    const result = listExpenses(session({ kind: "self", organizationId: orgId, operatorId: ownOperator }));
    expect(result.data.map((row) => row.id)).toEqual(["expense-own"]);
    expect(result.outlets).toEqual([{ id: ownStall, name: `OUT-${ownStall.slice(-2)}` }]);
    expect(getExpense(session({ kind: "self", organizationId: orgId, operatorId: ownOperator }), "expense-other-operator")).toBeNull();
  });

  it("limits area scope using the shift's persisted stall and fails closed for unsupported region scope", () => {
    const areaSession = session({ kind: "area", organizationId: orgId, areaId: "area-b" });
    expect(listExpenses(areaSession).data.map((row) => row.id)).toEqual(["expense-other-operator"]);
    const regionSession = session({ kind: "region", organizationId: orgId, regionId: "region-a" });
    expect(listExpenses(regionSession).data).toEqual([]);
    expect(getExpense(regionSession, "expense-own")).toBeNull();
  });

  it("keeps cash impact derived from payment source and applies deterministic bounded pagination", () => {
    const first = listExpenses(session({ kind: "org", organizationId: orgId }), { limit: 1, offset: 0 });
    expect(first.data).toHaveLength(1);
    expect(first.total).toBe(2);
    expect(first.data[0]?.cashImpact).toBe("REDUCES_EXPECTED_CASH");
    memoryStore.expenses.get("expense-own")!.paidFrom = "PERSONAL";
    const personal = getExpense(session({ kind: "org", organizationId: orgId }), "expense-own");
    expect(personal?.cashImpact).toBe("NONE");
  });
});
