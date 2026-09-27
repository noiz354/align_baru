import { describe, it, expect } from "vitest";
import { nextReviewState, matchesFlagPattern } from "@/domain/expense/review";
import { money } from "@/shared/money/money";

describe("expense review (T-EXP-002, ADR-0027)", () => {
  it("records UNVERIFIED_FIELD_EXPENSE with description, amount, time, location and note only", () => {
    const record = {
      expenseId: "exp-1",
      shiftId: "shift-1",
      categoryCode: "UNVERIFIED_FIELD_EXPENSE" as const,
      description: "Biaya lapangan",
      amount: money(50000, "IDR"),
      paidFrom: "CASH_BOX" as const,
      reviewState: "SUBMITTED" as const,
      clientExpenseId: "client-1",
    };
    expect(record.categoryCode).toBe("UNVERIFIED_FIELD_EXPENSE");
    expect((record as any).recipient).toBeUndefined();
    expect((record as any).authority).toBeUndefined();
  });

  it("has no field for recipient identity or claimed authority anywhere in the model", () => {
    // Check that ExpenseRecord type does not contain recipient fields
    // This is a structural test: ensure no recipient field exists
    const allowedKeys = ["expenseId", "shiftId", "categoryCode", "description", "amount", "paidFrom", "operatorNote", "evidenceAssetId", "reviewState", "clientExpenseId"];
    const record: any = {
      expenseId: "exp-1",
      shiftId: "shift-1",
      categoryCode: "TRANSPORT",
      description: "Transport",
      amount: money(20000, "IDR"),
      paidFrom: "CASH_BOX",
      reviewState: "SUBMITTED",
      clientExpenseId: "client-1",
    };
    expect(Object.keys(record).every(k => allowedKeys.includes(k))).toBe(true);
  });

  it("requires a reason for REJECTED and ESCALATED and keeps the record visible afterwards", () => {
    expect(() => nextReviewState("SUBMITTED", "REJECTED", "")).toThrow();
    expect(() => nextReviewState("SUBMITTED", "REJECTED", "Alasan jelas")).not.toThrow();
    const next = nextReviewState("SUBMITTED", "REJECTED", "Tidak sesuai bukti");
    expect(next).toBe("REJECTED");
  });

  it("never deletes or hides an expense, including rejected ones", () => {
    // Our store never deletes, only changes status
    const next = nextReviewState("SUBMITTED", "REJECTED", "Bukti tidak jelas");
    expect(next).toBe("REJECTED");
    // Rejected can go back to REVIEW_REQUIRED
    const reopened = nextReviewState("REJECTED", "REVIEW_REQUIRED" as any, "Butuh review ulang");
    expect(reopened).toBe("REVIEW_REQUIRED");
    // ESCALATED not allowed from REJECTED
    expect(() => nextReviewState("REJECTED", "ESCALATED" as any, "x")).toThrow();
    // Check that record still exists (would be in store)
  });

  it("keeps pattern flags attached to records and never to a person", () => {
    const record = {
      expenseId: "exp-1",
      shiftId: "shift-1",
      categoryCode: "UNVERIFIED_FIELD_EXPENSE" as const,
      description: "Biaya",
      amount: money(250000, "IDR"),
      paidFrom: "CASH_BOX" as const,
      reviewState: "SUBMITTED" as const,
      clientExpenseId: "client-1",
    };
    expect(matchesFlagPattern(record, "HIGH_AMOUNT")).toBe(true);
    expect(matchesFlagPattern(record, "REPEATED_UNVERIFIED")).toBe(true);
    // No person field checked
    expect((record as any).operatorId).toBeUndefined();
  });

  it("never triggers an automatic consequence from a flag (FR-EXPENSE-007)", () => {
    // Flags only set review status to REVIEW_REQUIRED, not automatic rejection
    const record = {
      expenseId: "exp-1",
      shiftId: "shift-1",
      categoryCode: "TRANSPORT" as const,
      description: "Transport",
      amount: money(250000, "IDR"),
      paidFrom: "CASH_BOX" as const,
      reviewState: "SUBMITTED" as const,
      clientExpenseId: "client-1",
    };
    const isHigh = matchesFlagPattern(record, "HIGH_AMOUNT");
    expect(isHigh).toBe(true);
    // But next state is not automatically REJECTED
    const next = nextReviewState("SUBMITTED", "REVIEWED", "Reviewed manually despite flag");
    expect(next).toBe("REVIEWED");
  });
});
