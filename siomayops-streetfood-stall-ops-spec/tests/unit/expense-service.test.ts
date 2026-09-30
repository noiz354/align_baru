import { afterEach, describe, expect, it } from "vitest";
import { reviewExpense } from "@/features/expenses";
import { memoryStore } from "@/server/db/memory-store";

const orgId = "00000000-0000-7000-0000-000000000001";
const expenseId = "expense-service-review";
const operatorId = "operator-service-review";

function storedExpense(organizationId = orgId) {
  memoryStore.expenses.set(expenseId, {
    id: expenseId, organizationId, shiftId: "shift-service-review", operatorId,
    category: "TRANSPORT", amountMinor: 25000, currency: "IDR", description: "",
    paidFrom: "CASH_BOX", reviewStatus: "SUBMITTED", clientExpenseId: "client-service-review",
    incurredAt: new Date(), createdAt: new Date(),
  });
}

afterEach(() => memoryStore.clear());

describe("expense review service safeguards", () => {
  it("rejects submitter self-review even when invoked below the HTTP authorization boundary", async () => {
    memoryStore.clear();
    storedExpense();
    await expect(reviewExpense({ expenseId, decision: "REVIEWED", reason: "Reviewed by submitter", reviewedBy: operatorId, organizationId: orgId })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(memoryStore.expenses.get(expenseId)?.reviewStatus).toBe("SUBMITTED");
  });

  it("does not allow a foreign organization service caller to review a record", async () => {
    memoryStore.clear();
    storedExpense("org-other");
    await expect(reviewExpense({ expenseId, decision: "REVIEWED", reason: "Reviewed externally", reviewedBy: "reviewer", organizationId: orgId })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(memoryStore.expenses.get(expenseId)?.reviewStatus).toBe("SUBMITTED");
  });
});
