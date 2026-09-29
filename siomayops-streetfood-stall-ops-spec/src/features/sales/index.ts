import { memoryStore, generateId, syncFromDiskIfNeeded, toJakartanBusinessDay } from "../../server/db/memory-store";
import { repositories } from "../../server/db/repository";
import { withIdempotency } from "../../server/db/idempotency";
import { authorize, type SessionContext } from "../../server/auth/port";
import type { Money } from "../../shared/money";
import { money } from "../../shared/money/money";
import { computeSaleTotalFromSnapshots } from "../../domain/sale/totals";
import { assertPaymentTransition, type PaymentMethod } from "../../domain/payment/states";
import { recordTransactionRequestSchema } from "../../shared/contracts/sales";
import { resolvePriceForSale } from "../pricing";
import { writeAuditEvent } from "../audit";
import { createHash } from "crypto";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface CreateSaleInput {
  shiftId: string;
  locationReportId?: string;
  sellingLocationId?: string;
  lines: { menuItemId: string; quantity: number; overridePriceId?: string }[];
  clientSaleId: string;
  recordedAtDevice?: Date;
  customerReference?: string;
  organizationId?: string;
}

export interface SaleResult {
  saleId: string;
  status: "DRAFT" | "COMPLETED" | "VOIDED" | "CORRECTED";
  total: Money;
  lines: { menuItemId: string; quantity: number; unitPriceSnapshot: Money; pricePolicyId?: string; lineTotal: Money }[];
  version: number;
}

export async function createSale(input: CreateSaleInput): Promise<SaleResult> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Idempotency via clientSaleId
  const existingSaleId = memoryStore.saleByClientId.get(input.clientSaleId);
  if (existingSaleId) {
    const existing = memoryStore.sales.get(existingSaleId);
    if (existing) {
      const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === existing.id);
      return {
        saleId: existing.id,
        status: existing.status as any,
        total: money(existing.totalMinor, "IDR"),
        lines: items.map(it => ({
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
          pricePolicyId: it.pricePolicyId,
          lineTotal: money(it.lineTotalMinor, "IDR"),
        })),
        version: existing.version,
      };
    }
  }

  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error(`Shift not open: ${shift.status}`), { code: "PRECONDITION_FAILED" });
  }

  const sellingLocationId = input.sellingLocationId || shift.startLocationId;
  // Resolve location report if needed
  let locationReportId = input.locationReportId;
  if (!locationReportId) {
    // Find current open report
    for (const r of memoryStore.locationReports.values()) {
      if (r.shiftId === input.shiftId && !r.departedAt) {
        locationReportId = r.id;
        break;
      }
    }
  }

  // Resolve prices for each line - price resolution uses server acceptance time (now) per ADR, not device time
  // Device time is preserved as occurredAt, but price is server-authoritative at acceptance
  const snapshots: { menuItemId: string; quantity: number; unitPriceSnapshot: Money; pricePolicyId?: string }[] = [];
  const serverNow = new Date();
  const at = serverNow; // price resolution at server time
  const occurredAt = input.recordedAtDevice || serverNow;
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw Object.assign(new Error(`Invalid quantity for ${line.menuItemId}`), { code: "VALIDATION_FAILED" });
    }
    const resolution = await resolvePriceForSale({
      menuItemId: line.menuItemId,
      sellingLocationId: sellingLocationId as any,
      at,
      organizationId: orgId,
    });
    if (resolution.kind === "NOT_SELLABLE") {
      throw Object.assign(new Error(`Item ${line.menuItemId} not sellable`), { code: "PRECONDITION_FAILED" });
    }
    if (resolution.kind === "AMBIGUOUS") {
      throw Object.assign(new Error(`Price ambiguous for ${line.menuItemId}`), { code: "CONFLICT" });
    }
    snapshots.push({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      unitPriceSnapshot: money(resolution.unitPriceMinor, "IDR"),
      pricePolicyId: resolution.pricePolicyId,
    });
  }

  // Compute totals from snapshots
  const totals = computeSaleTotalFromSnapshots(
    snapshots.map(s => ({
      menuItemId: s.menuItemId,
      quantity: s.quantity,
      unitPriceSnapshot: s.unitPriceSnapshot,
      pricePolicyId: s.pricePolicyId,
    }))
  );

  const saleId = generateId();
  const now = new Date();
  const saleRecord = {
    id: saleId,
    organizationId: orgId,
    shiftId: input.shiftId,
    sellingLocationId: sellingLocationId as string,
    operatorId: shift.operatorId,
    stallId: shift.stallId,
    businessDay: shift.businessDay,
    occurredAt,
    serverAcceptedAt: now,
    totalMinor: totals.payableTotal.amountMinor,
    currency: "IDR" as const,
    status: "DRAFT" as const,
    clientSaleId: input.clientSaleId,
    version: 1,
    createdAt: now,
  };
  memoryStore.sales.set(saleId, saleRecord);
  memoryStore.saleByClientId.set(input.clientSaleId, saleId);

  const lineResults: SaleResult["lines"] = [];
  for (const snap of snapshots) {
    const saleItemId = generateId();
    const lineTotalMinor = snap.unitPriceSnapshot.amountMinor * snap.quantity;
    memoryStore.saleItems.set(saleItemId, {
      id: saleItemId,
      organizationId: orgId,
      saleId,
      menuItemId: snap.menuItemId,
      quantity: snap.quantity,
      unitPriceMinor: snap.unitPriceSnapshot.amountMinor,
      lineTotalMinor,
      pricePolicyId: snap.pricePolicyId,
    });
    lineResults.push({
      menuItemId: snap.menuItemId,
      quantity: snap.quantity,
      unitPriceSnapshot: snap.unitPriceSnapshot,
      pricePolicyId: snap.pricePolicyId,
      lineTotal: money(lineTotalMinor, "IDR"),
    });
  }

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: shift.operatorId,
    action: "sale.created",
    subjectKind: "sale",
    subjectId: saleId,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { total: totals.payableTotal.amountMinor, lines: snapshots.length },
  });

  return {
    saleId,
    status: "DRAFT",
    total: totals.payableTotal,
    lines: lineResults,
    version: 1,
  };
}

export async function completeSale(saleId: string, paymentId?: string): Promise<SaleResult> {
  const sale = memoryStore.sales.get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  const wasCompleted = sale.status === "COMPLETED";
  sale.status = "COMPLETED";
  sale.version += 1;
  memoryStore.sales.set(sale.id, sale);

  const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === saleId);

  // Deduct stock once per sale (idempotent: only on first complete)
  if (!wasCompleted) {
    const menuToStock: Record<string,string> = {
      "00000000-0000-7000-0000-000000000101": "00000000-0000-7000-0000-000000000201",
      "00000000-0000-7000-0000-000000000102": "00000000-0000-7000-0000-000000000202",
      "00000000-0000-7000-0000-000000000103": "00000000-0000-7000-0000-000000000203",
      "00000000-0000-7000-0000-000000000104": "00000000-0000-7000-0000-000000000204",
    };
    const now = new Date();
    for (const it of items) {
      const stockItemId = menuToStock[it.menuItemId];
      if (!stockItemId) continue;
      // avoid duplicate movement for same sale+item (idempotent)
      const existing = Array.from(memoryStore.stockMovements.values()).find(m => m.clientMovementId === `sale-${saleId}-${it.menuItemId}`);
      if (existing) continue;
      const movId = generateId();
      memoryStore.stockMovements.set(movId, {
        id: movId,
        organizationId: sale.organizationId,
        stockItemId,
        stallId: sale.stallId,
        operatorId: sale.operatorId,
        shiftId: sale.shiftId,
        movementType: "SALE",
        quantity: -it.quantity,
        occurredAt: now,
        reason: `sale ${saleId}`,
        actorId: sale.operatorId,
        clientMovementId: `sale-${saleId}-${it.menuItemId}`,
      });
      memoryStore.movementByClientId.set(`sale-${saleId}-${it.menuItemId}`, movId);
    }
  }

  return {
    saleId: sale.id,
    status: "COMPLETED",
    total: money(sale.totalMinor, "IDR"),
    lines: items.map(it => ({
      menuItemId: it.menuItemId,
      quantity: it.quantity,
      unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
      pricePolicyId: it.pricePolicyId,
      lineTotal: money(it.lineTotalMinor, "IDR"),
    })),
    version: sale.version,
  };
}

export async function voidSale(saleId: string, reason: string, actorId?: string): Promise<void> {
  const sale = memoryStore.sales.get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { code: "NOT_FOUND" });
  if (!reason || reason.length < 3) throw new Error("Reason required");
  sale.status = "VOIDED";
  sale.version += 1;
  memoryStore.sales.set(sale.id, sale);
  await writeAuditEvent({
    organizationId: sale.organizationId,
    actorKind: "OPERATOR",
    actorId,
    action: "sale.voided",
    subjectKind: "sale",
    subjectId: saleId,
    reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: "COMPLETED" },
    afterSummary: { status: "VOIDED" },
  });
}

export async function getSaleById(saleId: string): Promise<SaleResult | null> {
  syncFromDiskIfNeeded();
  const sale = memoryStore.sales.get(saleId);
  if (!sale) return null;
  const items = Array.from(memoryStore.saleItems.values()).filter(i => i.saleId === saleId);
  return {
    saleId: sale.id,
    status: sale.status as any,
    total: money(sale.totalMinor, "IDR"),
    lines: items.map(it => ({
      menuItemId: it.menuItemId,
      quantity: it.quantity,
      unitPriceSnapshot: money(it.unitPriceMinor, "IDR"),
      pricePolicyId: it.pricePolicyId,
      lineTotal: money(it.lineTotalMinor, "IDR"),
    })),
    version: sale.version,
  };
}

export interface AuthorizedOutletInfo {
  readonly outletId: string;
  readonly stallId: string;
  readonly stallCode: string;
  readonly sellingLocationId: string;
  readonly locationName: string;
  readonly outletName: string;
  readonly areaId: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly shiftId: string;
  readonly shiftStatus: string;
}

export async function getAuthorizedOutlets(session: SessionContext): Promise<AuthorizedOutletInfo[]> {
  syncFromDiskIfNeeded();
  const { items: stalls } = await repositories.stalls.list(session.scope);
  const results: AuthorizedOutletInfo[] = [];

  for (const stall of stalls) {
    if (stall.status !== "ACTIVE") continue;

    // Find active shift for this stall
    let activeShift = Array.from(memoryStore.shifts.values()).find(
      s => s.organizationId === session.organizationId && s.stallId === stall.id && (s.status === "OPEN" || s.status === "PENDING_SYNC")
    );

    // Find primary assignment if needed
    const assignment = Array.from(memoryStore.assignments.values()).find(
      a => a.organizationId === session.organizationId && a.stallId === stall.id
    );

    const operatorId = activeShift?.operatorId || assignment?.operatorId || "";
    if (session.scope.kind === "self") {
      const selfOpId = session.operatorId || session.scope.operatorId;
      if (selfOpId && operatorId !== selfOpId) continue;
    }

    const operator = operatorId ? memoryStore.operators.get(operatorId) : undefined;
    const locationId = activeShift?.startLocationId || Array.from(memoryStore.sellingLocations.values()).find(
      l => l.organizationId === session.organizationId && l.areaId === stall.areaId && l.status === "ACTIVE"
    )?.id || "";
    const location = locationId ? memoryStore.sellingLocations.get(locationId) : undefined;
    if (!location || location.status === "RESTRICTED" || location.status === "INACTIVE") continue;

    results.push({
      outletId: stall.id,
      stallId: stall.id,
      stallCode: stall.code,
      sellingLocationId: location.id,
      locationName: location.name,
      outletName: `${stall.code} — ${location.name}`,
      areaId: stall.areaId,
      operatorId: operator?.id || operatorId,
      operatorName: operator?.name || "Operator",
      shiftId: activeShift?.id || "",
      shiftStatus: activeShift?.status || "IDLE",
    });
  }

  results.sort((a, b) => a.stallCode.localeCompare(b.stallCode));
  return results;
}

export async function resolveAuthorizedOutlet(
  session: SessionContext,
  requestedOutletId: string,
  correlationId: string = generateId()
): Promise<AuthorizedOutletInfo> {
  syncFromDiskIfNeeded();
  const trimmedId = requestedOutletId.trim();

  // Look up raw stall (by id or code) or raw sellingLocation (by id)
  let rawStall =
    memoryStore.stalls.get(trimmedId) ||
    Array.from(memoryStore.stalls.values()).find(
      s => s.code === trimmedId && s.organizationId === session.organizationId
    ) ||
    Array.from(memoryStore.stalls.values()).find(s => s.code === trimmedId);

  let rawLocation = memoryStore.sellingLocations.get(trimmedId);

  if (!rawStall && rawLocation) {
    // Resolve stall operating at this location
    const shiftAtLocation = Array.from(memoryStore.shifts.values()).find(
      s => s.startLocationId === rawLocation!.id && (s.status === "OPEN" || s.status === "PENDING_SYNC")
    );
    if (shiftAtLocation) {
      rawStall = memoryStore.stalls.get(shiftAtLocation.stallId);
    } else {
      rawStall = Array.from(memoryStore.stalls.values()).find(
        s => s.organizationId === rawLocation!.organizationId && s.areaId === rawLocation!.areaId
      );
    }
  }

  if (!rawStall && !rawLocation) {
    throw Object.assign(new Error("Outlet tidak ditemukan"), {
      code: "NOT_FOUND",
      status: 404,
      details: { fieldErrors: { outletId: ["Outlet tidak ditemukan"] } },
    });
  }

  const targetOrgId = rawStall?.organizationId || rawLocation!.organizationId;
  if (targetOrgId !== session.organizationId) {
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER",
      actorId: session.operatorId || session.userId,
      actorRole: session.roles[0],
      action: "authz.denied",
      subjectKind: "outlet",
      subjectId: trimmedId,
      reason: "cross_organization_outlet_access",
      correlationId,
      occurredAt: new Date(),
      afterSummary: { requestedOutletId: trimmedId, targetOrgId, sessionOrgId: session.organizationId },
    });
    throw Object.assign(new Error("Forbidden: Outlet berada di luar organisasi Anda"), {
      code: "FORBIDDEN",
      status: 403,
      details: { fieldErrors: { outletId: ["Anda tidak memiliki akses ke outlet ini"] } },
    });
  }

  if (!rawStall) {
    throw Object.assign(new Error("Gerobak untuk outlet ini tidak ditemukan"), {
      code: "NOT_FOUND",
      status: 404,
      details: { fieldErrors: { outletId: ["Gerobak untuk outlet ini tidak ditemukan"] } },
    });
  }

  // Area scope check
  if (
    (session.scope.kind === "area" || session.roles.includes("AREA_SUPERVISOR")) &&
    session.scope.areaId &&
    rawStall.areaId !== session.scope.areaId
  ) {
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: "HQ_USER",
      actorId: session.userId,
      actorRole: session.roles[0],
      action: "authz.denied",
      subjectKind: "outlet",
      subjectId: rawStall.id,
      reason: "area_scope_violation",
      correlationId,
      occurredAt: new Date(),
      afterSummary: { requestedAreaId: rawStall.areaId, sessionAreaId: session.scope.areaId },
    });
    throw Object.assign(new Error("Forbidden: Outlet berada di luar area kerja Anda"), {
      code: "FORBIDDEN",
      status: 403,
      details: { fieldErrors: { outletId: ["Outlet berada di luar area kerja Anda"] } },
    });
  }

  // Stall scope check
  if (session.scope.kind === "stall" && session.scope.stallId && rawStall.id !== session.scope.stallId) {
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: "OPERATOR",
      actorId: session.operatorId || session.userId,
      actorRole: session.roles[0],
      action: "authz.denied",
      subjectKind: "outlet",
      subjectId: rawStall.id,
      reason: "stall_scope_violation",
      correlationId,
      occurredAt: new Date(),
      afterSummary: { requestedStallId: rawStall.id, sessionStallId: session.scope.stallId },
    });
    throw Object.assign(new Error("Forbidden: Outlet berada di luar cakupan gerobak Anda"), {
      code: "FORBIDDEN",
      status: 403,
      details: { fieldErrors: { outletId: ["Outlet berada di luar cakupan gerobak Anda"] } },
    });
  }

  // Find active shift for this stall
  const activeShift = Array.from(memoryStore.shifts.values()).find(
    s => s.organizationId === session.organizationId && s.stallId === rawStall!.id && (s.status === "OPEN" || s.status === "PENDING_SYNC")
  );

  // Self (operator) scope check
  if (session.scope.kind === "self") {
    const selfOpId = session.operatorId || session.scope.operatorId;
    const assignedToStall = Array.from(memoryStore.assignments.values()).some(
      a => a.organizationId === session.organizationId && a.stallId === rawStall!.id && a.operatorId === selfOpId
    );
    const ownsActiveShift = activeShift?.operatorId === selfOpId;
    if (!selfOpId || (!assignedToStall && !ownsActiveShift)) {
      await writeAuditEvent({
        organizationId: session.organizationId,
        actorKind: "OPERATOR",
        actorId: selfOpId || session.userId,
        actorRole: session.roles[0],
        action: "authz.denied",
        subjectKind: "outlet",
        subjectId: rawStall.id,
        reason: "self_scope_violation",
        correlationId,
        occurredAt: new Date(),
        afterSummary: { requestedStallId: rawStall.id, operatorId: selfOpId },
      });
      throw Object.assign(new Error("Forbidden: Anda tidak ditugaskan pada outlet ini"), {
        code: "FORBIDDEN",
        status: 403,
        details: { fieldErrors: { outletId: ["Anda tidak ditugaskan pada outlet ini"] } },
      });
    }
  }

  if (rawStall.status !== "ACTIVE") {
    throw Object.assign(new Error(`Gerobak tidak aktif (${rawStall.status})`), {
      code: "PRECONDITION_FAILED",
      status: 412,
      details: { fieldErrors: { outletId: [`Gerobak tidak aktif (${rawStall.status})`] } },
    });
  }

  if (!activeShift) {
    throw Object.assign(new Error("Tidak ada shift aktif pada outlet ini"), {
      code: "PRECONDITION_FAILED",
      status: 412,
      details: { fieldErrors: { outletId: ["Tidak ada shift aktif pada outlet ini"] } },
    });
  }

  const location =
    rawLocation ||
    memoryStore.sellingLocations.get(activeShift.startLocationId);

  if (!location || location.status === "RESTRICTED" || location.status === "INACTIVE") {
    throw Object.assign(new Error("Lokasi penjualan pada outlet ini tidak aktif atau dibatasi"), {
      code: "PRECONDITION_FAILED",
      status: 412,
      details: { fieldErrors: { outletId: ["Lokasi penjualan tidak aktif atau dibatasi"] } },
    });
  }

  const operator = memoryStore.operators.get(activeShift.operatorId);

  return {
    outletId: rawStall.id,
    stallId: rawStall.id,
    stallCode: rawStall.code,
    sellingLocationId: location.id,
    locationName: location.name,
    outletName: `${rawStall.code} — ${location.name}`,
    areaId: rawStall.areaId,
    operatorId: activeShift.operatorId,
    operatorName: operator?.name || "Operator",
    shiftId: activeShift.id,
    shiftStatus: activeShift.status,
  };
}

export interface RecordTransactionResult {
  readonly saleId: string;
  readonly paymentId: string;
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
  readonly amount: Money;
  readonly paymentMethod: PaymentMethod;
  readonly status: "COMPLETED" | "DRAFT";
  readonly paymentStatus: "PAID" | "PENDING_VERIFICATION";
  readonly occurredAt: string;
  readonly serverAcceptedAt: string;
  readonly note?: string;
  readonly replayed: boolean;
}

export async function recordTransaction(
  session: SessionContext | null | undefined,
  rawInput: unknown,
  options?: { idempotencyKey?: string; correlationId?: string }
): Promise<RecordTransactionResult> {
  syncFromDiskIfNeeded();
  const correlationId = options?.correlationId || generateId();

  // 1. Authentication check
  if (!session || !session.organizationId || !session.userId) {
    throw Object.assign(new Error("Sesi tidak terautentikasi"), {
      code: "UNAUTHENTICATED",
      status: 401,
    });
  }

  // 2. Role permission check
  try {
    authorize(session, "sale:create", session.scope);
  } catch (e: any) {
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER",
      actorId: session.operatorId || session.userId,
      actorRole: session.roles[0],
      action: "authz.denied",
      subjectKind: "sale",
      subjectId: "create",
      reason: e.message || "role_permission_denied",
      correlationId,
      occurredAt: new Date(),
      afterSummary: { roles: session.roles, attemptedAction: "sale:create" },
    });
    throw Object.assign(new Error(e.message || "Forbidden"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }

  // 3. Extract ONLY allowed fields (prevents mass-assignment of organizationId, operatorId, createdAt, status, etc.)
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw Object.assign(new Error("Payload transaksi tidak valid"), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: { formErrors: ["Payload transaksi harus berupa objek"] },
    });
  }

  const inputObj = rawInput as Record<string, unknown>;
  let extractedAmount: unknown = inputObj.amount;
  if (
    extractedAmount &&
    typeof extractedAmount === "object" &&
    "amountMinor" in (extractedAmount as Record<string, unknown>)
  ) {
    extractedAmount = (extractedAmount as Record<string, unknown>).amountMinor;
  } else if (extractedAmount === undefined && inputObj.amountMinor !== undefined) {
    extractedAmount = inputObj.amountMinor;
  }

  // Reject stringified NaN/Infinity or non-number types explicitly before Zod
  if (typeof extractedAmount !== "number" || !Number.isFinite(extractedAmount)) {
    throw Object.assign(new Error("Nominal transaksi harus berupa bilangan bulat Rupiah yang valid"), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: { fieldErrors: { amount: ["Nominal transaksi harus berupa angka bulat positif"] } },
    });
  }

  const candidate = {
    outletId: typeof inputObj.outletId === "string" ? inputObj.outletId : "",
    amount: extractedAmount,
    paymentMethod: inputObj.paymentMethod ?? "CASH",
    occurredAt:
      typeof inputObj.occurredAt === "string" && inputObj.occurredAt.trim().length > 0
        ? inputObj.occurredAt.trim()
        : undefined,
    note:
      typeof inputObj.note === "string" && inputObj.note.trim().length > 0
        ? inputObj.note.trim()
        : undefined,
    clientTransactionId:
      typeof inputObj.clientTransactionId === "string" && inputObj.clientTransactionId.trim().length > 0
        ? inputObj.clientTransactionId.trim()
        : typeof inputObj.clientSaleId === "string" && inputObj.clientSaleId.trim().length > 0
          ? inputObj.clientSaleId.trim()
          : undefined,
  };

  const parsed = recordTransactionRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstMsg =
      Object.values(flat.fieldErrors).flat()[0] ||
      flat.formErrors[0] ||
      "Data transaksi tidak valid";
    throw Object.assign(new Error(firstMsg), {
      code: "VALIDATION_FAILED",
      status: 400,
      details: flat,
    });
  }

  const validData = parsed.data;

  // 4. Timestamp validation (business-time semantics per ADR-0033)
  const serverNow = new Date();
  let occurredAtDate = serverNow;
  if (validData.occurredAt !== undefined) {
    const parsedDate = new Date(validData.occurredAt);
    if (Number.isNaN(parsedDate.getTime())) {
      throw Object.assign(new Error("Format waktu transaksi tidak valid"), {
        code: "VALIDATION_FAILED",
        status: 400,
        details: { fieldErrors: { occurredAt: ["Format waktu transaksi tidak valid"] } },
      });
    }
    const maxFutureMs = 5 * 60 * 1000; // 5-minute clock-skew tolerance
    if (parsedDate.getTime() > serverNow.getTime() + maxFutureMs) {
      throw Object.assign(new Error("Waktu transaksi tidak boleh di masa depan"), {
        code: "VALIDATION_FAILED",
        status: 400,
        details: { fieldErrors: { occurredAt: ["Waktu transaksi tidak boleh di masa depan"] } },
      });
    }
    const maxPastMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (parsedDate.getTime() < serverNow.getTime() - maxPastMs) {
      throw Object.assign(new Error("Waktu transaksi terlalu lampau (maksimal 30 hari)"), {
        code: "VALIDATION_FAILED",
        status: 400,
        details: { fieldErrors: { occurredAt: ["Waktu transaksi terlalu lampau (maksimal 30 hari)"] } },
      });
    }
    occurredAtDate = parsedDate;
  }

  // 5. Money primitive construction (enforces integer minor units, IDR)
  const amountMoney = money(validData.amount, "IDR");

  // 6. Server-side outlet scope & authorization resolution
  const outlet = await resolveAuthorizedOutlet(session, validData.outletId, correlationId);

  // 7. Idempotency & duplicate submission protection
  const idempotencyKey = (options?.idempotencyKey || validData.clientTransactionId || "").trim();
  const clientTransactionId = idempotencyKey || generateId();
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        outletId: outlet.stallId,
        amountMinor: amountMoney.amountMinor,
        paymentMethod: validData.paymentMethod,
        note: validData.note || "",
      })
    )
    .digest("hex");

  const executeWrite = async (): Promise<{ body: Omit<RecordTransactionResult, "replayed">; status: number }> => {
    // Secondary check by clientSaleId in repository
    const existingSale = await repositories.sales.findByClientId(session.scope, clientTransactionId);
    if (existingSale) {
      const existingPayment = await repositories.payments.findBySaleId(session.scope, existingSale.id);
      return {
        body: {
          saleId: existingSale.id,
          paymentId: existingPayment?.id || "",
          outletId: outlet.outletId,
          outletName: outlet.outletName,
          stallId: outlet.stallId,
          stallCode: outlet.stallCode,
          sellingLocationId: outlet.sellingLocationId,
          locationName: outlet.locationName,
          operatorId: existingSale.operatorId,
          operatorName: outlet.operatorName,
          shiftId: existingSale.shiftId,
          businessDay: existingSale.businessDay,
          amount: money(existingSale.totalMinor, "IDR"),
          paymentMethod: (existingPayment?.method || validData.paymentMethod) as PaymentMethod,
          status: existingSale.status as "COMPLETED" | "DRAFT",
          paymentStatus: (existingPayment?.status || "PAID") as "PAID" | "PENDING_VERIFICATION",
          occurredAt: existingSale.occurredAt.toISOString(),
          serverAcceptedAt: existingSale.serverAcceptedAt.toISOString(),
          note: existingSale.note,
        },
        status: 201,
      };
    }

    const isCash = validData.paymentMethod === "CASH";
    const targetPaymentStatus = isCash ? "PAID" : "PENDING_VERIFICATION";
    const targetSaleStatus = isCash ? "COMPLETED" : "DRAFT";

    // Domain state machine check
    assertPaymentTransition("PENDING", targetPaymentStatus, {
      actorKind: "OPERATOR",
      hasVerifiedProviderEvidence: false,
      hasReconciliationRecord: false,
      isOfflineReplay: false,
    });

    const shift = memoryStore.shifts.get(outlet.shiftId);
    const businessDay = shift?.businessDay || toJakartanBusinessDay(serverNow);

    const saleId = generateId();
    const saleItemId = generateId();
    const paymentId = generateId();
    const clientPaymentId = `pay-${clientTransactionId}`;

    // Protected fields derived strictly server-side
    const saleRecord = {
      id: saleId,
      organizationId: session.organizationId,
      shiftId: outlet.shiftId,
      sellingLocationId: outlet.sellingLocationId,
      operatorId: outlet.operatorId,
      stallId: outlet.stallId,
      businessDay,
      occurredAt: occurredAtDate,
      serverAcceptedAt: serverNow,
      totalMinor: amountMoney.amountMinor,
      currency: "IDR" as const,
      status: targetSaleStatus as "COMPLETED" | "DRAFT",
      clientSaleId: clientTransactionId,
      note: validData.note,
      customerReference: validData.note,
      version: 1,
      createdAt: serverNow,
    };

    const defaultMenuItemId =
      Array.from(memoryStore.menuItems.values()).find(m => m.organizationId === session.organizationId)?.id ||
      "00000000-0000-7000-0000-000000000101";

    const saleItemRecord = {
      id: saleItemId,
      organizationId: session.organizationId,
      saleId,
      menuItemId: defaultMenuItemId,
      quantity: 1,
      unitPriceMinor: amountMoney.amountMinor,
      lineTotalMinor: amountMoney.amountMinor,
    };

    const paymentRecord = {
      id: paymentId,
      organizationId: session.organizationId,
      saleId,
      method: validData.paymentMethod as PaymentMethod,
      amountMinor: amountMoney.amountMinor,
      currency: "IDR" as const,
      status: targetPaymentStatus as "PAID" | "PENDING_VERIFICATION",
      providerReference: isCash ? undefined : `PROV-${saleId.slice(0, 8).toUpperCase()}`,
      clientPaymentId,
      createdAt: serverNow,
      updatedAt: serverNow,
    };

    await repositories.sales.createTransaction(session.scope, {
      sale: saleRecord,
      saleItem: saleItemRecord,
      payment: paymentRecord,
    });

    const actorKind = session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER";
    const actorId = session.operatorId || session.userId;

    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind,
      actorId,
      actorRole: session.roles[0],
      action: "sale.created",
      subjectKind: "sale",
      subjectId: saleId,
      correlationId,
      occurredAt: serverNow,
      afterSummary: {
        totalMinor: amountMoney.amountMinor,
        stallId: outlet.stallId,
        sellingLocationId: outlet.sellingLocationId,
        paymentMethod: validData.paymentMethod,
        status: targetSaleStatus,
        note: validData.note,
      },
    });

    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind,
      actorId,
      actorRole: session.roles[0],
      action: "payment.recorded",
      subjectKind: "payment",
      subjectId: paymentId,
      correlationId,
      occurredAt: serverNow,
      afterSummary: {
        saleId,
        method: validData.paymentMethod,
        amountMinor: amountMoney.amountMinor,
        status: targetPaymentStatus,
      },
    });

    return {
      body: {
        saleId,
        paymentId,
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
        amount: amountMoney,
        paymentMethod: validData.paymentMethod,
        status: targetSaleStatus,
        paymentStatus: targetPaymentStatus,
        occurredAt: occurredAtDate.toISOString(),
        serverAcceptedAt: serverNow.toISOString(),
        note: validData.note,
      },
      status: 201,
    };
  };

  if (idempotencyKey) {
    try {
      const idempotentResult = await withIdempotency(
        {
          organizationId: session.organizationId,
          route: "POST /api/v1/transactions",
          idempotencyKey,
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
        throw Object.assign(new Error(e.message), {
          code: "IDEMPOTENCY_MISMATCH",
          status: 422,
        });
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
