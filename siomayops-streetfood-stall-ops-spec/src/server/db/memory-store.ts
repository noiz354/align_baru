/**
 * In-memory store for development and tests.
 * Production would use Postgres via Drizzle, but this provides working persistence for the pilot implementation.
 * Every table includes organization_id for scoping (INV-11, ARC-08).
 * Persistence: file-backed via data/db.json (survives restart), atomic write.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type OrganizationId = string;

export interface StoredOperator {
  id: string;
  organizationId: string;
  areaId: string;
  name: string;
  phoneE164: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "OFFBOARDED";
  contractType: string;
  trainingState: string;
  startedOn?: string;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
}

export interface StoredStall {
  id: string;
  organizationId: string;
  areaId: string;
  code: string;
  type: string;
  status: string;
  createdAt: Date;
}

export interface StoredAssignment {
  id: string;
  organizationId: string;
  operatorId: string;
  stallId: string;
  areaId: string;
  type: "PRIMARY" | "RELIEF" | "TEMPORARY" | "TRAINEE_ACCOMPANIED";
  validFrom: Date;
  validTo?: Date;
  createdBy: string;
}

export interface StoredSellingLocation {
  id: string;
  organizationId: string;
  areaId: string;
  name: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  status: "AVAILABLE" | "ACTIVE" | "CROWDED" | "TEMPORARILY_UNAVAILABLE" | "RESTRICTED" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredShift {
  id: string;
  organizationId: string;
  operatorId: string;
  stallId: string;
  businessDay: string;
  startedAt: Date;
  endedAt?: Date;
  startLocationId: string;
  openingCashMinor: number;
  currency: "IDR";
  status: "DRAFT_OFFLINE" | "OPEN" | "SUSPENDED" | "PENDING_SYNC" | "CLOSING_SUBMITTED" | "CLOSED_ACCEPTED" | "CLOSED_RETURNED" | "VOID";
  clientShiftId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredLocationReport {
  id: string;
  organizationId: string;
  shiftId: string;
  stallId: string;
  operatorId: string;
  sellingLocationId: string;
  trigger: "ARRIVED" | "CONFIRM_UNCHANGED" | "MOVE_SITE" | "STEPPED_AWAY" | "DEPARTED";
  reasonForMove?: string;
  note?: string;
  arrivedAt: Date;
  departedAt?: Date;
  clientReportId: string;
  createdAt: Date;
}

export interface StoredMenuCategory {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
}

export interface StoredMenuItem {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  portionNote?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface StoredPricePolicy {
  id: string;
  organizationId: string;
  menuItemId: string;
  scope: "ORG" | "AREA" | "LOCATION";
  scopeId: string;
  unitPriceMinor: number;
  currency: "IDR";
  effectiveFrom: Date;
  effectiveTo?: Date;
  reason: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: Date;
}

export interface StoredPriceAcknowledgement {
  id: string;
  organizationId: string;
  operatorId: string;
  priceSetDigest: string;
  acknowledgedAt: Date;
  createdAt: Date;
}

export interface StoredSale {
  id: string;
  organizationId: string;
  shiftId: string;
  sellingLocationId: string;
  operatorId: string;
  stallId: string;
  businessDay: string;
  occurredAt: Date;
  serverAcceptedAt: Date;
  totalMinor: number;
  currency: "IDR";
  status: "DRAFT" | "COMPLETED" | "VOIDED" | "CORRECTED";
  clientSaleId: string;
  version: number;
  createdAt: Date;
}

export interface StoredSaleItem {
  id: string;
  organizationId: string;
  saleId: string;
  menuItemId: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  pricePolicyId?: string;
}

export interface StoredPayment {
  id: string;
  organizationId: string;
  saleId: string;
  method: "CASH" | "QRIS_STATIC" | "QRIS_DYNAMIC" | "BANK_TRANSFER" | "EWALLET" | "OTHER_DIGITAL";
  amountMinor: number;
  currency: "IDR";
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED" | "PENDING_VERIFICATION";
  providerReference?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  clientPaymentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPaymentCallback {
  id: string;
  organizationId: string;
  paymentId?: string;
  provider: string;
  providerReference: string;
  signatureValid: boolean;
  receivedAt: Date;
  rawPayloadJson: string;
  dedupeKey: string;
}

export interface StoredExpense {
  id: string;
  organizationId: string;
  shiftId: string;
  operatorId: string;
  sellingLocationId?: string;
  category: string;
  amountMinor: number;
  currency: "IDR";
  description: string;
  note?: string;
  paidFrom: "CASH_BOX" | "PERSONAL";
  evidenceObjectKey?: string;
  reviewStatus: "SUBMITTED" | "REVIEW_REQUIRED" | "REVIEWED" | "REJECTED" | "ESCALATED";
  flaggedReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  clientExpenseId: string;
  incurredAt: Date;
  createdAt: Date;
}

export interface StoredStockItem {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  active: boolean;
}

export interface StoredStockMovement {
  id: string;
  organizationId: string;
  stockItemId: string;
  stallId?: string;
  operatorId?: string;
  shiftId?: string;
  movementType: string;
  quantity: number;
  occurredAt: Date;
  reason?: string;
  actorId: string;
  clientMovementId: string;
}

export interface StoredStockSnapshot {
  id: string;
  organizationId: string;
  shiftId: string;
  stockItemId: string;
  phase: "START" | "END";
  countedQuantity: number | null;
  expectedQuantity?: number;
  varianceQuantity?: number;
  reason?: string;
}

export interface StoredClosing {
  id: string;
  organizationId: string;
  shiftId: string;
  submittedAt: Date;
  openingCashMinor: number;
  cashSalesMinor: number;
  cashExpensesMinor: number;
  expectedCashMinor: number;
  countedCashMinor: number;
  cashVarianceMinor: number;
  digitalExpectedMinor: number;
  digitalReceivedMinor: number;
  notes?: string;
  status: "PENDING_SYNC" | "CLOSING_SUBMITTED" | "CLOSED_ACCEPTED" | "CLOSED_RETURNED";
  clientClosingId: string;
}

export interface StoredAuditEvent {
  id: string;
  organizationId: string;
  actorId?: string;
  actorKind: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  previousValueJson?: string;
  newValueJson?: string;
  reason?: string;
  requestId: string;
  ipHash?: string;
}

export interface StoredIdempotency {
  id: string;
  organizationId: string;
  route: string;
  idempotencyKey: string;
  requestHash: string;
  responseJson: string;
  statusCode: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface StoredLoyaltyAccount {
  id: string;
  organizationId: string;
  phoneE164?: string;
  consentGiven: boolean;
  consentAt?: Date;
  createdAt: Date;
}

export interface StoredRewardInstance {
  id: string;
  organizationId: string;
  loyaltyAccountId: string;
  rewardDefinitionId: string;
  periodKey: string;
  issuedAt: Date;
  expiresAt?: Date;
  redeemedAt?: Date;
  redeemedSaleId?: string;
}

export interface StoredIncident {
  id: string;
  organizationId: string;
  shiftId?: string;
  operatorId: string;
  category: string;
  description: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "ESCALATED" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredAlert {
  id: string;
  organizationId: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  acknowledged: boolean;
  createdAt: Date;
}

class MemoryStore {
  operators = new Map<string, StoredOperator>();
  stalls = new Map<string, StoredStall>();
  assignments = new Map<string, StoredAssignment>();
  sellingLocations = new Map<string, StoredSellingLocation>();
  shifts = new Map<string, StoredShift>();
  locationReports = new Map<string, StoredLocationReport>();
  menuCategories = new Map<string, StoredMenuCategory>();
  menuItems = new Map<string, StoredMenuItem>();
  pricePolicies = new Map<string, StoredPricePolicy>();
  priceAcknowledgements = new Map<string, StoredPriceAcknowledgement>();
  sales = new Map<string, StoredSale>();
  saleItems = new Map<string, StoredSaleItem>();
  payments = new Map<string, StoredPayment>();
  paymentCallbacks = new Map<string, StoredPaymentCallback>();
  expenses = new Map<string, StoredExpense>();
  stockItems = new Map<string, StoredStockItem>();
  stockMovements = new Map<string, StoredStockMovement>();
  stockSnapshots = new Map<string, StoredStockSnapshot>();
  closings = new Map<string, StoredClosing>();
  auditEvents: StoredAuditEvent[] = [];
  idempotency = new Map<string, StoredIdempotency>(); // key: org|route|key
  loyaltyAccounts = new Map<string, StoredLoyaltyAccount>();
  rewardInstances = new Map<string, StoredRewardInstance>();
  incidents = new Map<string, StoredIncident>();
  alerts = new Map<string, StoredAlert>();
  evidenceAssets = new Map<string, any>();
  notifications = new Map<string, any>();
  shiftClosings = new Map<string, any>();

  // indexes for client ids
  shiftByClientId = new Map<string, string>(); // clientShiftId -> shiftId
  saleByClientId = new Map<string, string>();
  paymentByClientId = new Map<string, string>();
  expenseByClientId = new Map<string, string>();
  locationReportByClientId = new Map<string, string>();
  closingByClientId = new Map<string, string>();
  movementByClientId = new Map<string, string>();

  clear() {
    this.operators.clear();
    this.stalls.clear();
    this.assignments.clear();
    this.sellingLocations.clear();
    this.shifts.clear();
    this.locationReports.clear();
    this.menuCategories.clear();
    this.menuItems.clear();
    this.pricePolicies.clear();
    this.priceAcknowledgements.clear();
    this.sales.clear();
    this.saleItems.clear();
    this.payments.clear();
    this.paymentCallbacks.clear();
    this.expenses.clear();
    this.stockItems.clear();
    this.stockMovements.clear();
    this.stockSnapshots.clear();
    this.closings.clear();
    this.auditEvents = [];
    this.idempotency.clear();
    this.loyaltyAccounts.clear();
    this.rewardInstances.clear();
    this.incidents.clear();
    this.alerts.clear();
    this.evidenceAssets.clear();
    this.notifications.clear();
    this.shiftClosings.clear();
    this.shiftByClientId.clear();
    this.saleByClientId.clear();
    this.paymentByClientId.clear();
    this.expenseByClientId.clear();
    this.locationReportByClientId.clear();
    this.closingByClientId.clear();
    this.movementByClientId.clear();
    // persist after clear (will write empty but seed will repopulate on next load)
    try { persistStore(); } catch {}
  }
}

// Singleton
export const memoryStore = new MemoryStore();

// --- Persistence layer (file-backed) ---
const DB_PATH = process.env.SIOMAYOPS_DATA_FILE
  ? path.resolve(process.env.SIOMAYOPS_DATA_FILE)
  : process.env.NODE_ENV === "test"
    ? path.join(os.tmpdir(), `siomayops-test-${process.pid}.json`)
    : path.join(process.cwd(), "data", "db.json");

function dateReviver(_key: string, value: any) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

function persistStore() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      operators: Array.from(memoryStore.operators.entries()),
      stalls: Array.from(memoryStore.stalls.entries()),
      assignments: Array.from(memoryStore.assignments.entries()),
      sellingLocations: Array.from(memoryStore.sellingLocations.entries()),
      shifts: Array.from(memoryStore.shifts.entries()),
      locationReports: Array.from(memoryStore.locationReports.entries()),
      menuCategories: Array.from(memoryStore.menuCategories.entries()),
      menuItems: Array.from(memoryStore.menuItems.entries()),
      pricePolicies: Array.from(memoryStore.pricePolicies.entries()),
      priceAcknowledgements: Array.from(memoryStore.priceAcknowledgements.entries()),
      sales: Array.from(memoryStore.sales.entries()),
      saleItems: Array.from(memoryStore.saleItems.entries()),
      payments: Array.from(memoryStore.payments.entries()),
      paymentCallbacks: Array.from(memoryStore.paymentCallbacks.entries()),
      expenses: Array.from(memoryStore.expenses.entries()),
      stockItems: Array.from(memoryStore.stockItems.entries()),
      stockMovements: Array.from(memoryStore.stockMovements.entries()),
      stockSnapshots: Array.from(memoryStore.stockSnapshots.entries()),
      closings: Array.from(memoryStore.closings.entries()),
      auditEvents: memoryStore.auditEvents,
      idempotency: Array.from(memoryStore.idempotency.entries()),
      loyaltyAccounts: Array.from(memoryStore.loyaltyAccounts.entries()),
      rewardInstances: Array.from(memoryStore.rewardInstances.entries()),
      incidents: Array.from(memoryStore.incidents.entries()),
      alerts: Array.from(memoryStore.alerts.entries()),
      evidenceAssets: Array.from(memoryStore.evidenceAssets.entries()),
      notifications: Array.from(memoryStore.notifications.entries()),
      shiftClosings: Array.from(memoryStore.shiftClosings.entries()),
      shiftByClientId: Array.from(memoryStore.shiftByClientId.entries()),
      saleByClientId: Array.from(memoryStore.saleByClientId.entries()),
      paymentByClientId: Array.from(memoryStore.paymentByClientId.entries()),
      expenseByClientId: Array.from(memoryStore.expenseByClientId.entries()),
      locationReportByClientId: Array.from(memoryStore.locationReportByClientId.entries()),
      closingByClientId: Array.from(memoryStore.closingByClientId.entries()),
      movementByClientId: Array.from(memoryStore.movementByClientId.entries()),
    };
    const tmp = DB_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, DB_PATH);
  } catch {}
}

function loadStore(): boolean {
  try {
    if (!fs.existsSync(DB_PATH)) return false;
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    if (!raw) return false;
    const data = JSON.parse(raw, dateReviver);
    // restore maps
    if (data.operators) memoryStore.operators = new Map(data.operators);
    if (data.stalls) memoryStore.stalls = new Map(data.stalls);
    if (data.assignments) memoryStore.assignments = new Map(data.assignments);
    if (data.sellingLocations) memoryStore.sellingLocations = new Map(data.sellingLocations);
    if (data.shifts) memoryStore.shifts = new Map(data.shifts);
    if (data.locationReports) memoryStore.locationReports = new Map(data.locationReports);
    if (data.menuCategories) memoryStore.menuCategories = new Map(data.menuCategories);
    if (data.menuItems) memoryStore.menuItems = new Map(data.menuItems);
    if (data.pricePolicies) memoryStore.pricePolicies = new Map(data.pricePolicies);
    if (data.priceAcknowledgements) memoryStore.priceAcknowledgements = new Map(data.priceAcknowledgements);
    if (data.sales) memoryStore.sales = new Map(data.sales);
    if (data.saleItems) memoryStore.saleItems = new Map(data.saleItems);
    if (data.payments) memoryStore.payments = new Map(data.payments);
    if (data.paymentCallbacks) memoryStore.paymentCallbacks = new Map(data.paymentCallbacks);
    if (data.expenses) memoryStore.expenses = new Map(data.expenses);
    if (data.stockItems) memoryStore.stockItems = new Map(data.stockItems);
    if (data.stockMovements) memoryStore.stockMovements = new Map(data.stockMovements);
    if (data.stockSnapshots) memoryStore.stockSnapshots = new Map(data.stockSnapshots);
    if (data.closings) memoryStore.closings = new Map(data.closings);
    if (data.auditEvents) memoryStore.auditEvents = data.auditEvents;
    if (data.idempotency) memoryStore.idempotency = new Map(data.idempotency);
    if (data.loyaltyAccounts) memoryStore.loyaltyAccounts = new Map(data.loyaltyAccounts);
    if (data.rewardInstances) memoryStore.rewardInstances = new Map(data.rewardInstances);
    if (data.incidents) memoryStore.incidents = new Map(data.incidents);
    if (data.alerts) memoryStore.alerts = new Map(data.alerts);
    if (data.evidenceAssets) memoryStore.evidenceAssets = new Map(data.evidenceAssets);
    if (data.notifications) memoryStore.notifications = new Map(data.notifications);
    if (data.shiftClosings) memoryStore.shiftClosings = new Map(data.shiftClosings);
    if (data.shiftByClientId) memoryStore.shiftByClientId = new Map(data.shiftByClientId);
    if (data.saleByClientId) memoryStore.saleByClientId = new Map(data.saleByClientId);
    if (data.paymentByClientId) memoryStore.paymentByClientId = new Map(data.paymentByClientId);
    if (data.expenseByClientId) memoryStore.expenseByClientId = new Map(data.expenseByClientId);
    if (data.locationReportByClientId) memoryStore.locationReportByClientId = new Map(data.locationReportByClientId);
    if (data.closingByClientId) memoryStore.closingByClientId = new Map(data.closingByClientId);
    if (data.movementByClientId) memoryStore.movementByClientId = new Map(data.movementByClientId);
    return true;
  } catch {
    return false;
  }
}

// Wrap map mutations to auto-persist
function wrapMapsForPersist() {
  const mapKeys: (keyof MemoryStore)[] = [
    "operators","stalls","assignments","sellingLocations","shifts","locationReports",
    "menuCategories","menuItems","pricePolicies","priceAcknowledgements","sales","saleItems",
    "payments","paymentCallbacks","expenses","stockItems","stockMovements","stockSnapshots",
    "closings","idempotency","loyaltyAccounts","rewardInstances","incidents","alerts",
    "evidenceAssets","notifications","shiftClosings","shiftByClientId","saleByClientId",
    "paymentByClientId","expenseByClientId","locationReportByClientId","closingByClientId","movementByClientId"
  ];
  for (const k of mapKeys) {
    const m = (memoryStore as any)[k] as Map<any,any>;
    if (!(m instanceof Map)) continue;
    const origSet = m.set.bind(m);
    const origDelete = m.delete.bind(m);
    const origClear = m.clear.bind(m);
    (m as any).set = (key: any, val: any) => { const r = origSet(key, val); persistStore(); return r; };
    (m as any).delete = (key: any) => { const r = origDelete(key); if (r) persistStore(); return r; };
    (m as any).clear = () => { const r = origClear(); persistStore(); return r; };
  }
  // auditEvents is array: wrap push
  const origPush = memoryStore.auditEvents.push.bind(memoryStore.auditEvents);
  (memoryStore.auditEvents as any).push = (...args: any[]) => { const r = origPush(...args); persistStore(); return r; };
  // also wrap splice etc that may be used? We handle generic array mutation via proxy would be complex; we handle push only plus after writes we also call persistStore explicitly in writeAuditEvent
}

// Deterministic seed for POS vertical slice
function toJakartanBusinessDay(now: Date): string {
  // same logic as toBusinessDay with cut 4, Jakarta UTC+7
  const utcMs = now.getTime();
  const jakartaMs = utcMs + 7 * 60 * 60 * 1000;
  const d = new Date(jakartaMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  let y = year, m = month, dd = day;
  if (hour < 4) {
    const prev = new Date(Date.UTC(y, m - 1, dd));
    prev.setUTCDate(prev.getUTCDate() - 1);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth() + 1;
    dd = prev.getUTCDate();
  }
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  return `${y}-${pad2(m)}-${pad2(dd)}`;
}

function ensureSeed() {
  const ORG = "00000000-0000-7000-0000-000000000001";
  const AREA = "00000000-0000-7000-0000-000000000003";
  const OPERATOR = "00000000-0000-7000-0000-000000000010";
  const STALL = "00000000-0000-7000-0000-000000000020";
  const LOC = "00000000-0000-7000-0000-000000000030";
  const now = new Date();

  let seeded = false;

  // Operators
  if (!memoryStore.operators.has(OPERATOR)) {
    memoryStore.operators.set(OPERATOR, {
      id: OPERATOR,
      organizationId: ORG,
      areaId: AREA,
      name: "Budi",
      phoneE164: "+6281234567890",
      status: "ACTIVE",
      contractType: "FULL_TIME",
      trainingState: "TRAINED",
      startedOn: "2026-01-15",
      createdAt: now,
      updatedAt: now,
      active: true,
    });
    seeded = true;
  }
  // Second operator for HQ
  const OP2 = "00000000-0000-7000-0000-000000000011";
  if (!memoryStore.operators.has(OP2)) {
    memoryStore.operators.set(OP2, {
      id: OP2,
      organizationId: ORG,
      areaId: AREA,
      name: "Sari",
      phoneE164: "+6281234567891",
      status: "ACTIVE",
      contractType: "FULL_TIME",
      trainingState: "TRAINED",
      createdAt: now,
      updatedAt: now,
      active: true,
    });
    seeded = true;
  }

  // Stall
  if (!memoryStore.stalls.has(STALL)) {
    memoryStore.stalls.set(STALL, {
      id: STALL,
      organizationId: ORG,
      areaId: AREA,
      code: "ST-001",
      type: "MOBILE",
      status: "ACTIVE",
      createdAt: now,
    });
    seeded = true;
  }

  // Selling location
  if (!memoryStore.sellingLocations.has(LOC)) {
    memoryStore.sellingLocations.set(LOC, {
      id: LOC,
      organizationId: ORG,
      areaId: AREA,
      name: "Alun-alun Bandung",
      addressText: "Jl. Asia Afrika No.1, Bandung",
      lat: -6.921,
      lng: 107.607,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    seeded = true;
  }

  // Assignment
  const ASSIGN = "00000000-0000-7000-0000-000000000040";
  if (!memoryStore.assignments.has(ASSIGN)) {
    memoryStore.assignments.set(ASSIGN, {
      id: ASSIGN,
      organizationId: ORG,
      operatorId: OPERATOR,
      stallId: STALL,
      areaId: AREA,
      type: "PRIMARY",
      validFrom: now,
      createdBy: OPERATOR,
    });
    seeded = true;
  }

  // Menu categories
  const CAT1 = "00000000-0000-7000-0000-000000000050";
  const CAT2 = "00000000-0000-7000-0000-000000000051";
  if (!memoryStore.menuCategories.has(CAT1)) {
    memoryStore.menuCategories.set(CAT1, { id: CAT1, organizationId: ORG, name: "Siomay", sortOrder: 1 });
    memoryStore.menuCategories.set(CAT2, { id: CAT2, organizationId: ORG, name: "Minuman", sortOrder: 2 });
    seeded = true;
  }

  // Menu items — 4 items matching MOCK_MENU prices
  const menuSeed: { id: string; name: string; cat: string; price: number; sort: number }[] = [
    { id: "00000000-0000-7000-0000-000000000101", name: "Siomay Ayam", cat: CAT1, price: 15000, sort: 1 },
    { id: "00000000-0000-7000-0000-000000000102", name: "Siomay Campur", cat: CAT1, price: 18000, sort: 2 },
    { id: "00000000-0000-7000-0000-000000000103", name: "Batagor", cat: CAT1, price: 12000, sort: 3 },
    { id: "00000000-0000-7000-0000-000000000104", name: "Es Teh", cat: CAT2, price: 5000, sort: 4 },
  ];
  for (const m of menuSeed) {
    if (!memoryStore.menuItems.has(m.id)) {
      memoryStore.menuItems.set(m.id, {
        id: m.id,
        organizationId: ORG,
        categoryId: m.cat,
        name: m.name,
        active: true,
        sortOrder: m.sort,
        createdAt: now,
      });
      seeded = true;
    }
    // price policy
    const policyExists = Array.from(memoryStore.pricePolicies.values()).some(p => p.menuItemId === m.id && p.organizationId === ORG);
    if (!policyExists) {
      const pid = `pp-${m.id.slice(-4)}`;
      memoryStore.pricePolicies.set(pid, {
        id: pid,
        organizationId: ORG,
        menuItemId: m.id,
        scope: "ORG",
        scopeId: ORG,
        unitPriceMinor: m.price,
        currency: "IDR",
        effectiveFrom: new Date(now.getTime() - 24*3600*1000),
        reason: "seed: initial price",
        createdBy: OPERATOR,
        createdAt: now,
      });
      seeded = true;
    }
  }

  // Stock items — 4 items (matching menu 1:1 for POS vertical)
  const stockSeed: { id: string; name: string; code: string }[] = [
    { id: "00000000-0000-7000-0000-000000000201", name: "Siomay Ayam", code: "STK-001" },
    { id: "00000000-0000-7000-0000-000000000202", name: "Siomay Campur", code: "STK-002" },
    { id: "00000000-0000-7000-0000-000000000203", name: "Batagor", code: "STK-003" },
    { id: "00000000-0000-7000-0000-000000000204", name: "Es Teh", code: "STK-004" },
  ];
  for (const s of stockSeed) {
    if (!memoryStore.stockItems.has(s.id)) {
      memoryStore.stockItems.set(s.id, {
        id: s.id,
        organizationId: ORG,
        code: s.code,
        name: s.name,
        category: s.name === "Es Teh" ? "MINUMAN" : "MAKANAN",
        unit: "porsi",
        active: true,
      });
      seeded = true;
    }
  }

  // Initial stock movements: 40 each if no movements yet
  const hasMovements = Array.from(memoryStore.stockMovements.values()).some(m => m.organizationId === ORG);
  if (!hasMovements) {
    for (const s of stockSeed) {
      const mid = `mov-init-${s.id.slice(-4)}`;
      memoryStore.stockMovements.set(mid, {
        id: mid,
        organizationId: ORG,
        stockItemId: s.id,
        stallId: STALL,
        operatorId: OPERATOR,
        movementType: "RESTOCK",
        quantity: 40,
        occurredAt: now,
        reason: "seed: opening stock",
        actorId: OPERATOR,
        clientMovementId: `client-${mid}`,
      });
      memoryStore.movementByClientId.set(`client-${mid}`, mid);
    }
    seeded = true;
  }

  // Seed an OPEN shift if none exists for operator
  const hasOpenShift = Array.from(memoryStore.shifts.values()).some(s => s.operatorId === OPERATOR && (s.status === "OPEN" || s.status === "PENDING_SYNC"));
  if (!hasOpenShift) {
    const shiftId = "00000000-0000-7000-0000-000000000001";
    // only create if not exists (idempotent)
    if (!memoryStore.shifts.has(shiftId)) {
      const businessDay = toJakartanBusinessDay(now);
      const shift: StoredShift = {
        id: shiftId,
        organizationId: ORG,
        operatorId: OPERATOR,
        stallId: STALL,
        businessDay,
        startedAt: now,
        startLocationId: LOC,
        openingCashMinor: 50000,
        currency: "IDR",
        status: "OPEN",
        clientShiftId: shiftId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.shifts.set(shiftId, shift);
      memoryStore.shiftByClientId.set(shiftId, shiftId);
      // location report ARRIVED
      const reportId = "00000000-0000-7000-0000-000000000031";
      if (!memoryStore.locationReports.has(reportId)) {
        memoryStore.locationReports.set(reportId, {
          id: reportId,
          organizationId: ORG,
          shiftId,
          stallId: STALL,
          operatorId: OPERATOR,
          sellingLocationId: LOC,
          trigger: "ARRIVED",
          arrivedAt: now,
          clientReportId: reportId,
          createdAt: now,
        });
        memoryStore.locationReportByClientId.set(reportId, reportId);
      }
      // stock snapshots START
      for (const s of stockSeed) {
        const snapId = `snap-start-${s.id.slice(-4)}`;
        if (!memoryStore.stockSnapshots.has(snapId)) {
          memoryStore.stockSnapshots.set(snapId, {
            id: snapId,
            organizationId: ORG,
            shiftId,
            stockItemId: s.id,
            phase: "START",
            countedQuantity: 40,
            expectedQuantity: 40,
          });
        }
      }
      seeded = true;
    }
  }

  if (seeded) persistStore();
}

// Initialize persistence
const loaded = loadStore();
wrapMapsForPersist();
ensureSeed();
if (!loaded) persistStore();

// Helpers
export function generateId(): string {
  // UUIDv7-like: use crypto randomUUID if available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  // fallback
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function idempotencyMapKey(orgId: string, route: string, key: string): string {
  return `${orgId}|${route}|${key}`;
}

// expose persist for explicit calls
export function persistNow() { persistStore(); }
