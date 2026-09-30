import crypto from "node:crypto";
import { memoryStore, generateId, syncFromDiskIfNeeded, toJakartanBusinessDay, type StoredExpense } from "../../server/db/memory-store";
import { repositories } from "../../server/db/repository";
import { withIdempotency } from "../../server/db/idempotency";
import { authorize, type SessionContext } from "../../server/auth/port";
import type { Scope } from "../../shared/types/scope";
import { recordExpenseRequestSchema } from "../../shared/contracts/expenses";
import { resolveAuthorizedOutlet } from "../sales";
import type { Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { EXPENSE_CATEGORY_CODES, nextReviewState, matchesFlagPattern, type ExpenseCategoryCode, type ExpenseRecord, type ExpenseReviewState, type ExpensePaidFrom } from "../../domain/expense/review";
import { money } from "../../shared/money/money";

export * from "./read-model";
export * from "./analytics";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface SubmitExpenseInput {
  shiftId: string;
  categoryId?: string;
  categoryCode?: string;
  description?: string;
  amount: Money;
  paidFrom: "CASH_BOX" | "PERSONAL";
  operatorNote?: string;
  evidenceAssetId?: string;
  clientExpenseId: string;
  recordedAtDevice?: Date;
  sellingLocationId?: string;
  operatorId?: string;
  organizationId?: string;
  actorId?: string;
  actorKind?: "OPERATOR" | "HQ_USER";
}

export async function submitExpense(input: SubmitExpenseInput): Promise<{ expenseId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Client IDs are globally indexed by the current map adapter; prevent cross-tenant replay.
  const existingId = memoryStore.expenseByClientId.get(input.clientExpenseId);
  if (existingId) {
    const existing = memoryStore.expenses.get(existingId);
    if (existing && existing.organizationId !== orgId) {
      throw Object.assign(new Error("Client expense id is already assigned"), { code: "CONFLICT", status: 409 });
    }
    if (existing) {
      const matchesRequest = existing.shiftId === input.shiftId
        && existing.category === (input.categoryCode || "OTHER_OPERATIONAL")
        && existing.amountMinor === input.amount.amountMinor
        && existing.paidFrom === input.paidFrom
        && existing.description === (input.description?.trim() ?? "")
        && (existing.note ?? "") === (input.operatorNote?.trim() ?? "");
      if (!matchesRequest) throw Object.assign(new Error("Client expense id was reused with different data"), { code: "CONFLICT", status: 409 });
      return { expenseId: existing.id };
    }
  }
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift || shift.organizationId !== orgId) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND", status: 404 });
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error("Shift is not open for expense submissions"), { code: "PRECONDITION_FAILED", status: 409 });
  }
  if (!Number.isSafeInteger(input.amount.amountMinor) || input.amount.amountMinor <= 0) {
    throw Object.assign(new Error("Expense amount must be a positive integer"), { code: "VALIDATION_FAILED", status: 400 });
  }

  const candidateCategory = input.categoryCode || "OTHER_OPERATIONAL";
  if (!(EXPENSE_CATEGORY_CODES as readonly string[]).includes(candidateCategory)) {
    throw Object.assign(new Error("Unsupported expense category"), { code: "VALIDATION_FAILED", status: 400 });
  }
  const category = candidateCategory as ExpenseCategoryCode;

  const id = generateId();
  const now = new Date();
  const activeLocation = Array.from(memoryStore.locationReports.values())
    .filter((report) => report.organizationId === orgId && report.shiftId === shift.id && !report.departedAt)
    .sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime())[0];
  const expense: StoredExpense = {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    operatorId: shift.operatorId,
    sellingLocationId: input.sellingLocationId ?? activeLocation?.sellingLocationId ?? shift.startLocationId,
    category,
    amountMinor: input.amount.amountMinor,
    currency: "IDR" as const,
    description: input.description?.trim() ?? "",
    note: input.operatorNote?.trim() || undefined,
    paidFrom: input.paidFrom,
    evidenceObjectKey: input.evidenceAssetId,
    reviewStatus: "SUBMITTED" as const,
    clientExpenseId: input.clientExpenseId,
    incurredAt: input.recordedAtDevice ?? now,
    createdAt: now,
  };
  memoryStore.expenses.set(id, expense);
  memoryStore.expenseByClientId.set(input.clientExpenseId, id);

  // Flagging check
  const record: ExpenseRecord = {
    expenseId: id,
    shiftId: input.shiftId,
    categoryCode: category,
    description: input.description ?? "",
    amount: input.amount,
    paidFrom: input.paidFrom,
    operatorNote: input.operatorNote,
    evidenceAssetId: input.evidenceAssetId,
    reviewState: "SUBMITTED",
    clientExpenseId: input.clientExpenseId,
  };
  let flaggedReason: string | undefined;
  if (matchesFlagPattern(record, "HIGH_AMOUNT")) flaggedReason = "HIGH_AMOUNT";
  else if (matchesFlagPattern(record, "NO_EVIDENCE_HIGH")) flaggedReason = "NO_EVIDENCE_HIGH";
  else if (matchesFlagPattern(record, "ROUND_AMOUNT")) flaggedReason = "ROUND_AMOUNT";

  if (flaggedReason) {
    expense.reviewStatus = "REVIEW_REQUIRED";
    expense.flaggedReason = flaggedReason;
    await writeAuditEvent({
      organizationId: orgId,
      actorKind: "SYSTEM",
      action: "expense.flagged",
      subjectKind: "expense",
      subjectId: id,
      correlationId: generateId(),
      occurredAt: now,
      afterSummary: { flaggedReason },
    });
  }

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: input.actorKind ?? "OPERATOR",
    actorId: input.actorId ?? expense.operatorId,
    action: "expense.submitted",
    subjectKind: "expense",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { category, amount: input.amount.amountMinor, paidFrom: input.paidFrom },
  });

  return { expenseId: id };
}

export interface RecordExpenseResult {
  readonly expenseId: string;
  readonly outletId: string;
  readonly outletName: string;
  readonly stallId: string;
  readonly stallCode: string;
  readonly sellingLocationId: string;
  readonly locationName: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly shiftId: string;
  readonly businessDay: string;
  readonly categoryCode: ExpenseCategoryCode;
  readonly description: string;
  readonly note?: string;
  readonly amount: Money;
  readonly paidFrom: ExpensePaidFrom;
  readonly reviewStatus: ExpenseReviewState;
  readonly flaggedReason?: string;
  readonly incurredAt: string;
  readonly createdAt: string;
  readonly replayed: boolean;
}

export async function recordExpense(
  session: SessionContext | null | undefined,
  rawInput: unknown,
  options?: { idempotencyKey?: string; correlationId?: string }
): Promise<RecordExpenseResult> {
  syncFromDiskIfNeeded();
  const correlationId = options?.correlationId || generateId();

  if (!session || !session.organizationId || !session.userId) {
    throw Object.assign(new Error("Sesi tidak terautentikasi"), {
      code: "UNAUTHENTICATED",
      status: 401,
    });
  }

  // Role permission check
  try {
    authorize(session, "expense:submit", session.scope);
  } catch (e: any) {
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER",
      actorId: session.operatorId || session.userId,
      actorRole: session.roles[0],
      action: "authz.denied",
      subjectKind: "expense",
      subjectId: "submit",
      reason: e.message || "role_permission_denied",
      correlationId,
      occurredAt: new Date(),
      afterSummary: { roles: session.roles, attemptedAction: "expense:submit" },
    });
    throw Object.assign(new Error(e.message || "Forbidden"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw Object.assign(new Error("Payload pengeluaran tidak valid"), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: { formErrors: ["Payload pengeluaran harus berupa objek"] },
    });
  }

  const rawObj = rawInput as Record<string, any>;
  let resolvedOutletId = typeof rawObj.outletId === "string" ? rawObj.outletId.trim() : "";
  if (!resolvedOutletId && typeof rawObj.shiftId === "string" && rawObj.shiftId.trim()) {
    const shift = memoryStore.shifts.get(rawObj.shiftId.trim());
    if (shift && shift.organizationId === session.organizationId) {
      resolvedOutletId = shift.stallId;
    } else if (shift && shift.organizationId !== session.organizationId) {
      throw Object.assign(new Error("Akses ditolak: shift milik organisasi lain"), {
        code: "FORBIDDEN",
        status: 403,
      });
    } else {
      throw Object.assign(new Error("Shift atau outlet tidak ditemukan"), {
        code: "NOT_FOUND",
        status: 404,
      });
    }
  }

  const rawAmount =
    typeof rawObj.amount === "number"
      ? rawObj.amount
      : typeof rawObj.amountMinor === "number"
        ? rawObj.amountMinor
        : rawObj.amount && typeof rawObj.amount === "object" && typeof rawObj.amount.amountMinor === "number"
          ? rawObj.amount.amountMinor
          : rawObj.amount;

  if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount)) {
    throw Object.assign(new Error("Nominal pengeluaran harus berupa bilangan bulat Rupiah yang valid"), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: { fieldErrors: { amount: ["Nominal pengeluaran harus berupa angka bulat positif"] } },
    });
  }

  const rawCategory =
    typeof rawObj.categoryCode === "string" && rawObj.categoryCode.trim()
      ? rawObj.categoryCode.trim()
      : typeof rawObj.category === "string" && rawObj.category.trim()
        ? rawObj.category.trim()
        : undefined;

  const rawNote =
    typeof rawObj.note === "string" && rawObj.note.trim().length > 0
      ? rawObj.note.trim()
      : typeof rawObj.operatorNote === "string" && rawObj.operatorNote.trim().length > 0
        ? rawObj.operatorNote.trim()
        : undefined;

  const rawIncurredAt =
    typeof rawObj.incurredAt === "string" && rawObj.incurredAt.trim()
      ? rawObj.incurredAt.trim()
      : typeof rawObj.recordedAtDevice === "string" && rawObj.recordedAtDevice.trim()
        ? rawObj.recordedAtDevice.trim()
        : undefined;

  const normalizedCandidate = {
    outletId: resolvedOutletId,
    categoryCode: rawCategory,
    amount: rawAmount,
    description: typeof rawObj.description === "string" ? rawObj.description : "",
    paidFrom: rawObj.paidFrom || "CASH_BOX",
    incurredAt: rawIncurredAt,
    note: rawNote,
    evidenceAssetId: typeof rawObj.evidenceAssetId === "string" ? rawObj.evidenceAssetId : undefined,
    clientExpenseId:
      typeof rawObj.clientExpenseId === "string" && rawObj.clientExpenseId.trim().length > 0
        ? rawObj.clientExpenseId.trim()
        : undefined,
  };

  const parsed = recordExpenseRequestSchema.safeParse(normalizedCandidate);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstMsg =
      Object.values(flat.fieldErrors).flat()[0] ||
      flat.formErrors[0] ||
      "Data pengeluaran tidak valid";
    throw Object.assign(new Error(firstMsg), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: flat,
    });
  }

  const input = parsed.data;

  // Resolve and authorize target outlet (verifies org, area, stall, and self scope)
  const outlet = await resolveAuthorizedOutlet(session, input.outletId, correlationId);

  // Also explicitly authorize expense:submit against the target stall scope
  const targetScope: Scope = {
    kind: "stall",
    organizationId: session.organizationId,
    areaId: outlet.areaId,
    stallId: outlet.stallId,
    operatorId: session.operatorId,
  };
  try {
    authorize(session, "expense:submit", targetScope);
  } catch (e: any) {
    throw Object.assign(new Error(e.message || "Akses ditolak untuk mencatat pengeluaran di outlet ini"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const amountMoney = money(input.amount, "IDR");
  const effectiveIdempotencyKey =
    (options?.idempotencyKey && options.idempotencyKey.trim()) ||
    (input.clientExpenseId && input.clientExpenseId.trim()) ||
    "";
  const clientExpenseId = effectiveIdempotencyKey || generateId();

  const requestHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        outletId: outlet.stallId,
        categoryCode: input.categoryCode,
        amountMinor: amountMoney.amountMinor,
        description: input.description,
        paidFrom: input.paidFrom,
        note: input.note || "",
        incurredAt: input.incurredAt || "",
      })
    )
    .digest("hex");

  const executeWrite = async (): Promise<{ body: Omit<RecordExpenseResult, "replayed">; status: number }> => {
    const existing = await repositories.expenses.findByClientId(session.scope, clientExpenseId);
    if (existing) {
      return {
        body: {
          expenseId: existing.id,
          outletId: outlet.outletId,
          outletName: outlet.outletName,
          stallId: outlet.stallId,
          stallCode: outlet.stallCode,
          sellingLocationId: outlet.sellingLocationId,
          locationName: outlet.locationName,
          operatorId: existing.operatorId,
          operatorName: outlet.operatorName,
          shiftId: existing.shiftId,
          businessDay: existing.businessDay || toJakartanBusinessDay(existing.incurredAt),
          categoryCode: existing.category as ExpenseCategoryCode,
          description: existing.description,
          note: existing.note,
          amount: money(existing.amountMinor, "IDR"),
          paidFrom: existing.paidFrom,
          reviewStatus: existing.reviewStatus,
          flaggedReason: existing.flaggedReason,
          incurredAt: existing.incurredAt.toISOString(),
          createdAt: existing.createdAt.toISOString(),
        },
        status: 201,
      };
    }

    const now = new Date();
    const incurredAt = input.incurredAt ? new Date(input.incurredAt) : now;
    const shift = memoryStore.shifts.get(outlet.shiftId);
    const businessDay = shift?.businessDay || toJakartanBusinessDay(incurredAt);
    const expenseId = generateId();

    // Evaluate record-level neutral flag patterns (never attached to person, never auto-rejects)
    const domainRecord: ExpenseRecord = {
      expenseId,
      shiftId: outlet.shiftId,
      categoryCode: input.categoryCode,
      description: input.description,
      amount: amountMoney,
      paidFrom: input.paidFrom,
      operatorNote: input.note,
      evidenceAssetId: input.evidenceAssetId,
      reviewState: "SUBMITTED",
      clientExpenseId,
    };

    let flaggedReason: string | undefined;
    if (matchesFlagPattern(domainRecord, "HIGH_AMOUNT")) flaggedReason = "HIGH_AMOUNT";
    else if (matchesFlagPattern(domainRecord, "NO_EVIDENCE_HIGH")) flaggedReason = "NO_EVIDENCE_HIGH";
    else if (matchesFlagPattern(domainRecord, "ROUND_AMOUNT")) flaggedReason = "ROUND_AMOUNT";
    else if (matchesFlagPattern(domainRecord, "REPEATED_UNVERIFIED")) flaggedReason = "REPEATED_UNVERIFIED";

    const reviewStatus: ExpenseReviewState = flaggedReason ? "REVIEW_REQUIRED" : "SUBMITTED";

    // Protected fields derived strictly server-side
    const storedExpense: StoredExpense = {
      id: expenseId,
      organizationId: session.organizationId,
      shiftId: outlet.shiftId,
      stallId: outlet.stallId,
      operatorId: outlet.operatorId,
      sellingLocationId: outlet.sellingLocationId,
      businessDay,
      category: input.categoryCode,
      amountMinor: amountMoney.amountMinor,
      currency: "IDR",
      description: input.description,
      note: input.note,
      paidFrom: input.paidFrom,
      evidenceObjectKey: input.evidenceAssetId,
      reviewStatus,
      flaggedReason,
      clientExpenseId,
      incurredAt,
      createdAt: now,
    };

    await repositories.expenses.createExpense(session.scope, storedExpense);

    if (flaggedReason) {
      await writeAuditEvent({
        organizationId: session.organizationId,
        actorKind: "SYSTEM",
        action: "expense.flagged",
        subjectKind: "expense",
        subjectId: expenseId,
        correlationId,
        occurredAt: now,
        afterSummary: { flaggedReason, reviewStatus },
      });
    }

    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER",
      actorId: session.operatorId || session.userId,
      actorRole: session.roles[0],
      action: "expense.submitted",
      subjectKind: "expense",
      subjectId: expenseId,
      correlationId,
      occurredAt: now,
      afterSummary: {
        stallId: outlet.stallId,
        stallCode: outlet.stallCode,
        categoryCode: input.categoryCode,
        amountMinor: amountMoney.amountMinor,
        paidFrom: input.paidFrom,
        description: input.description,
        note: input.note,
        reviewStatus,
      },
    });

    return {
      body: {
        expenseId,
        outletId: outlet.outletId,
        outletName: outlet.outletName,
        stallId: outlet.stallId,
        stallCode: outlet.stallCode,
        sellingLocationId: outlet.sellingLocationId,
        locationName: outlet.locationName,
        operatorId: outlet.operatorId,
        operatorName: outlet.operatorName,
        shiftId: outlet.shiftId,
        businessDay,
        categoryCode: input.categoryCode,
        description: input.description,
        note: input.note,
        amount: amountMoney,
        paidFrom: input.paidFrom,
        reviewStatus,
        flaggedReason,
        incurredAt: incurredAt.toISOString(),
        createdAt: now.toISOString(),
      },
      status: 201,
    };
  };

  if (effectiveIdempotencyKey && effectiveIdempotencyKey.length >= 8) {
    try {
      const idempotentResult = await withIdempotency(
        {
          organizationId: session.organizationId,
          route: "POST /api/v1/expenses",
          idempotencyKey: effectiveIdempotencyKey,
          requestHash,
          actorId: session.userId,
        },
        executeWrite
      );
      return {
        ...idempotentResult.body,
        amount: money(idempotentResult.body.amount.amountMinor, "IDR"),
        replayed: idempotentResult.replayed,
      };
    } catch (e: any) {
      if (e.code === "IDEMPOTENCY_MISMATCH") {
        throw Object.assign(
          new Error("Kunci idempotensi sudah digunakan dengan rincian pengeluaran yang berbeda"),
          { code: "IDEMPOTENCY_MISMATCH", status: 422 }
        );
      }
      throw e;
    }
  }

  const directResult = await executeWrite();
  return {
    ...directResult.body,
    replayed: false,
  };
}


export async function reviewExpense(input: {
  expenseId: string; decision: "REVIEWED" | "REJECTED" | "ESCALATED"; reason: string; reviewedBy: string; reviewerRole?: string; organizationId?: string; reviewerOperatorId?: string;
}): Promise<{ expenseId: string; newStatus: string }> {
  const expense = memoryStore.expenses.get(input.expenseId);
  if (!expense || (input.organizationId && expense.organizationId !== input.organizationId)) {
    throw Object.assign(new Error("Expense not found"), { code: "NOT_FOUND", status: 404 });
  }
  if (input.reviewedBy === expense.operatorId || input.reviewerOperatorId === expense.operatorId) {
    throw Object.assign(new Error("Submitter cannot review their own expense"), { code: "FORBIDDEN", status: 403 });
  }
  const current: ExpenseReviewState = expense.reviewStatus;
  let next: ExpenseReviewState;
  try {
    next = nextReviewState(current, input.decision, input.reason);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid review transition";
    throw Object.assign(new Error(message), { code: message.startsWith("Reason") ? "VALIDATION_FAILED" : "INVALID_TRANSITION", status: message.startsWith("Reason") ? 400 : 409 });
  }
  const prev = expense.reviewStatus;
  expense.reviewStatus = next;
  expense.reviewedBy = input.reviewedBy;
  expense.reviewedAt = new Date();
  expense.reviewReason = input.reason;
  memoryStore.expenses.set(expense.id, expense);

  const actionMap: Record<string, any> = {
    REVIEWED: "expense.reviewed",
    REJECTED: "expense.rejected",
    ESCALATED: "expense.escalated",
  };

  await writeAuditEvent({
    organizationId: expense.organizationId,
    actorKind: "HQ_USER",
    actorId: input.reviewedBy,
    actorRole: input.reviewerRole,
    action: actionMap[input.decision] || "expense.reviewed",
    subjectKind: "expense",
    subjectId: expense.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: next },
  });

  return { expenseId: expense.id, newStatus: next };
}

export async function listExpensesForShift(shiftId: string): Promise<any[]> {
  const result = [];
  for (const exp of memoryStore.expenses.values()) {
    if (exp.shiftId === shiftId) result.push(exp);
  }
  return result;
}

export async function listExpensesForReview(orgId: string, status?: string): Promise<any[]> {
  const result = [];
  for (const exp of memoryStore.expenses.values()) {
    if (exp.organizationId !== orgId) continue;
    if (status && exp.reviewStatus !== status) continue;
    result.push(exp);
  }
  return result;
}
