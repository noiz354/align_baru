/**
 * Deterministic fixture for the HQ dashboard UI tests.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. The fixture seeds the same
 * in-memory store the running app uses (`src/server/db/memory-store.ts`) and then drives the real
 * read model, so these tests exercise the shipping query path rather than a hand-built object.
 *
 * No dates are relative to "now" and no figures are random: a failing assertion must be
 * reproducible.
 */

import { memoryStore } from "@/server/db/memory-store";
import type {
  StoredAuditEvent,
  StoredExpense,
  StoredOperator,
  StoredPayment,
  StoredSale,
  StoredShift,
  StoredStall,
} from "@/server/db/memory-store";

export const ORG_ID = "00000000-0000-7000-0000-0000000000f1";
export const OTHER_ORG_ID = "00000000-0000-7000-0000-0000000000f9";
export const AREA_ID = "00000000-0000-7000-0000-0000000000a1";
export const OPERATOR_A = "00000000-0000-7000-0000-0000000000b1";
export const STALL_A = "00000000-0000-7000-0000-0000000000c1";
export const STALL_B = "00000000-0000-7000-0000-0000000000c2";
export const STALL_C_OTHER_ORG = "00000000-0000-7000-0000-0000000000c3";
export const BUSINESS_DAY = "2026-09-29";
export const EMPTY_BUSINESS_DAY = "2026-09-01";
/** 13:26 Jakarta on the business day above. */
export const NOW = new Date("2026-09-29T06:26:00.000Z");

function operator(id: string, name: string, orgId: string): StoredOperator {
  return {
    id,
    organizationId: orgId,
    areaId: AREA_ID,
    name,
    phoneE164: "+628000000000",
    status: "ACTIVE",
    contractType: "FULL_TIME",
    trainingState: "TRAINED",
    createdAt: NOW,
    updatedAt: NOW,
    active: true,
  };
}

function stall(id: string, code: string, orgId: string, status = "ACTIVE"): StoredStall {
  return { id, organizationId: orgId, areaId: AREA_ID, code, type: "MOBILE", status, createdAt: NOW };
}

function shift(id: string, stallId: string, orgId: string, overrides: Partial<StoredShift> = {}): StoredShift {
  return {
    id,
    organizationId: orgId,
    operatorId: OPERATOR_A,
    stallId,
    businessDay: BUSINESS_DAY,
    startedAt: new Date("2026-09-29T06:10:00.000Z"),
    startLocationId: "loc-1",
    openingCashMinor: 50000,
    currency: "IDR",
    status: "OPEN",
    clientShiftId: id,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function sale(id: string, stallId: string, shiftId: string, totalMinor: number, status: "DRAFT" | "COMPLETED", orgId = ORG_ID, businessDay = BUSINESS_DAY): StoredSale {
  return {
    id,
    organizationId: orgId,
    shiftId,
    sellingLocationId: "loc-1",
    operatorId: OPERATOR_A,
    stallId,
    businessDay,
    occurredAt: new Date("2026-09-29T06:26:00.000Z"),
    serverAcceptedAt: NOW,
    totalMinor,
    currency: "IDR",
    status,
    clientSaleId: id,
    version: 1,
    createdAt: NOW,
  };
}

function payment(id: string, saleId: string, method: StoredPayment["method"], status: StoredPayment["status"], amountMinor: number, orgId = ORG_ID): StoredPayment {
  return {
    id,
    organizationId: orgId,
    saleId,
    method,
    amountMinor,
    currency: "IDR",
    status,
    clientPaymentId: id,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function expense(id: string, shiftId: string, amountMinor: number, overrides: Partial<StoredExpense> = {}): StoredExpense {
  return {
    id,
    organizationId: ORG_ID,
    shiftId,
    operatorId: OPERATOR_A,
    category: "TRANSPORT",
    amountMinor,
    currency: "IDR",
    description: "Ongkos angkut",
    paidFrom: "CASH_BOX",
    reviewStatus: "SUBMITTED",
    clientExpenseId: id,
    incurredAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function audit(id: string, action: string, entityType: string, entityId: string, orgId = ORG_ID, occurredAt = NOW): StoredAuditEvent {
  return {
    id,
    organizationId: orgId,
    actorKind: "OPERATOR",
    action,
    entityType,
    entityId,
    occurredAt,
    requestId: `req-${id}`,
  };
}

export interface DashboardFixture {
  readonly orgId: string;
  readonly stallA: string;
  readonly stallB: string;
  readonly otherOrgStall: string;
}

/**
 * Two outlets in the organization, one empty day. Outlet A trades (Rp 35.000 cash completed,
 * Rp 18.000 unverified digital on a not-yet-completed sale, Rp 25.000 expenses); outlet B is
 * active but idle, which the alert rules must report.
 */
export function seedDashboardFixture(): DashboardFixture {
  memoryStore.clear();

  memoryStore.operators.set(OPERATOR_A, operator(OPERATOR_A, "Budi", ORG_ID));
  memoryStore.operators.set("op-b", operator("op-b", "Sari", ORG_ID));

  memoryStore.stalls.set(STALL_A, stall(STALL_A, "ST-001", ORG_ID));
  memoryStore.stalls.set(STALL_B, stall(STALL_B, "ST-002", ORG_ID));
  memoryStore.stalls.set(STALL_C_OTHER_ORG, stall(STALL_C_OTHER_ORG, "ST-900", OTHER_ORG_ID));

  memoryStore.shifts.set("shift-a", shift("shift-a", STALL_A, ORG_ID));
  memoryStore.locationReports.set("lr-a", {
    id: "lr-a",
    organizationId: ORG_ID,
    shiftId: "shift-a",
    stallId: STALL_A,
    operatorId: OPERATOR_A,
    sellingLocationId: "loc-1",
    trigger: "ARRIVED",
    arrivedAt: NOW,
    clientReportId: "lr-a",
    createdAt: NOW,
  });

  memoryStore.sales.set("sale-cash", sale("sale-cash", STALL_A, "shift-a", 35000, "COMPLETED"));
  memoryStore.sales.set("sale-digital", sale("sale-digital", STALL_A, "shift-a", 18000, "DRAFT"));
  memoryStore.payments.set("pay-cash", payment("pay-cash", "sale-cash", "CASH", "PAID", 35000));
  memoryStore.payments.set("pay-digital", payment("pay-digital", "sale-digital", "QRIS_STATIC", "PENDING_VERIFICATION", 18000));
  memoryStore.expenses.set("exp-1", expense("exp-1", "shift-a", 25000));

  memoryStore.auditEvents.push(
    audit("audit-1", "sale.created", "sale", "sale-cash"),
    audit("audit-2", "expense.submitted", "expense", "exp-1"),
    audit("audit-3", "unmapped.event", "unknown_kind", "x-1"),
    // A different business day: must not appear in this day's feed.
    audit("audit-old", "sale.created", "sale", "sale-old", ORG_ID, new Date("2026-08-30T06:00:00.000Z")),
  );

  return { orgId: ORG_ID, stallA: STALL_A, stallB: STALL_B, otherOrgStall: STALL_C_OTHER_ORG };
}

/** Removes the two outlets' day entirely: valid outlets, zero activity. */
export function seedEmptyBusinessDay(): void {
  memoryStore.shifts.clear();
  memoryStore.locationReports.clear();
  memoryStore.sales.clear();
  memoryStore.payments.clear();
  memoryStore.expenses.clear();
  memoryStore.auditEvents.length = 0;
}

export const FIXTURE_NOW = NOW;
