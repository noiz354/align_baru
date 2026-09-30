/**
 * In-memory store for development and tests.
 * Production would use Postgres via Drizzle, but this provides working persistence for the pilot implementation.
 * Every table includes organization_id for scoping (INV-11, ARC-08).
 * Persistence: file-backed via data/db.json (survives restart), atomic write.
 */

import fs from "node:fs";
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

export interface StoredGpsSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: Date;
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
  gpsSample?: StoredGpsSample;
  arrivedAt: Date;
  departedAt?: Date;
  clientReportId: string;
  createdAt: Date;
}

export type StoredTrafficBand = "QUIET" | "STEADY" | "BUSY" | "VERY_BUSY";
export interface StoredTrafficSample {
  id: string;
  organizationId: string;
  sellingLocationId: string;
  /** Deliberately coarse (hour bucket); no operatorId or shiftId by design. */
  sampledAt: Date;
  estimatedCount: number;
  trafficBand: StoredTrafficBand;
  note?: string;
  clientRequestId: string;
  videoAssetId?: string;
  videoStatus: "NOT_PROVIDED" | "UPLOADED" | "DELETED";
  createdAt: Date;
}
export interface StoredTrafficVideoAsset {
  id: string;
  organizationId: string;
  sellingLocationId: string;
  sampleId?: string;
  uploadedAt: Date;
  expiresAt: Date;
  contentType: "video/webm";
  byteSize: number;
  durationMs: number;
  clientRequestId: string;
  storageKey: string;
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
  note?: string;
  customerReference?: string;
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
  stallId?: string;
  operatorId: string;
  sellingLocationId?: string;
  businessDay?: string;
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
  trafficSamples = new Map<string, StoredTrafficSample>();
  trafficVideoAssets = new Map<string, StoredTrafficVideoAsset>();
  trafficSampleByClientId = new Map<string, string>();
  trafficVideoByClientId = new Map<string, string>();
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
    this.trafficSamples.clear();
    this.trafficVideoAssets.clear();
    this.trafficSampleByClientId.clear();
    this.trafficVideoByClientId.clear();
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
    this.auditEvents.splice(0, this.auditEvents.length);
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
    // Only persist on clear if an explicit SIOMAYOPS_DB_PATH is set and not in standard test runner
    if (process.env.SIOMAYOPS_DB_PATH) {
      try { persistStore(); } catch {}
    }
  }

  resetToSeed() {
    this.clear();
    ensureSeed();
  }

  reloadFromDisk(): boolean {
    return reloadStoreFromDisk();
  }
}

// Singleton shared across Next.js module contexts
const globalForStore = globalThis as unknown as {
  __siomayopsMemoryStore?: MemoryStore;
  __siomayopsWrapped?: boolean;
  __siomayopsLastMtimeMs?: number;
};

export const memoryStore: MemoryStore =
  globalForStore.__siomayopsMemoryStore ?? (globalForStore.__siomayopsMemoryStore = new MemoryStore());

// --- Persistence layer (file-backed) ---
const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "db.json");

function getDbPath(): string | null {
  if (process.env.SIOMAYOPS_DB_PATH) {
    return process.env.SIOMAYOPS_DB_PATH;
  }
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return null;
  }
  return DEFAULT_DB_PATH;
}

let isApplyingFromDisk = false;

function dateReviver(_key: string, value: any) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

function persistStore() {
  if (isApplyingFromDisk) return;
  const dbPath = getDbPath();
  if (!dbPath) return;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      operators: Array.from(memoryStore.operators.entries()),
      stalls: Array.from(memoryStore.stalls.entries()),
      assignments: Array.from(memoryStore.assignments.entries()),
      sellingLocations: Array.from(memoryStore.sellingLocations.entries()),
      shifts: Array.from(memoryStore.shifts.entries()),
      locationReports: Array.from(memoryStore.locationReports.entries()),
      trafficSamples: Array.from(memoryStore.trafficSamples.entries()),
      trafficVideoAssets: Array.from(memoryStore.trafficVideoAssets.entries()),
      trafficSampleByClientId: Array.from(memoryStore.trafficSampleByClientId.entries()),
      trafficVideoByClientId: Array.from(memoryStore.trafficVideoByClientId.entries()),
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
    const tmp = dbPath + `.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, dbPath);
    try {
      globalForStore.__siomayopsLastMtimeMs = fs.statSync(dbPath).mtimeMs;
    } catch {}
  } catch {}
}

function populateMap<K, V>(target: Map<K, V>, entries: Iterable<[K, V]> | undefined) {
  target.clear();
  if (!entries) return;
  for (const [k, v] of entries) {
    target.set(k, v);
  }
}

function loadStore(): boolean {
  const dbPath = getDbPath();
  if (!dbPath) return false;
  try {
    if (!fs.existsSync(dbPath)) return false;
    const raw = fs.readFileSync(dbPath, "utf-8");
    if (!raw) return false;
    const data = JSON.parse(raw, dateReviver);
    isApplyingFromDisk = true;
    try {
      populateMap(memoryStore.operators, data.operators);
      populateMap(memoryStore.stalls, data.stalls);
      populateMap(memoryStore.assignments, data.assignments);
      populateMap(memoryStore.sellingLocations, data.sellingLocations);
      populateMap(memoryStore.shifts, data.shifts);
      populateMap(memoryStore.locationReports, data.locationReports);
      populateMap(memoryStore.trafficSamples, data.trafficSamples);
      populateMap(memoryStore.trafficVideoAssets, data.trafficVideoAssets);
      populateMap(memoryStore.trafficSampleByClientId, data.trafficSampleByClientId);
      populateMap(memoryStore.trafficVideoByClientId, data.trafficVideoByClientId);
      populateMap(memoryStore.menuCategories, data.menuCategories);
      populateMap(memoryStore.menuItems, data.menuItems);
      populateMap(memoryStore.pricePolicies, data.pricePolicies);
      populateMap(memoryStore.priceAcknowledgements, data.priceAcknowledgements);
      populateMap(memoryStore.sales, data.sales);
      populateMap(memoryStore.saleItems, data.saleItems);
      populateMap(memoryStore.payments, data.payments);
      populateMap(memoryStore.paymentCallbacks, data.paymentCallbacks);
      populateMap(memoryStore.expenses, data.expenses);
      populateMap(memoryStore.stockItems, data.stockItems);
      populateMap(memoryStore.stockMovements, data.stockMovements);
      populateMap(memoryStore.stockSnapshots, data.stockSnapshots);
      populateMap(memoryStore.closings, data.closings);
      memoryStore.auditEvents.splice(0, memoryStore.auditEvents.length, ...(data.auditEvents || []));
      populateMap(memoryStore.idempotency, data.idempotency);
      populateMap(memoryStore.loyaltyAccounts, data.loyaltyAccounts);
      populateMap(memoryStore.rewardInstances, data.rewardInstances);
      populateMap(memoryStore.incidents, data.incidents);
      populateMap(memoryStore.alerts, data.alerts);
      populateMap(memoryStore.evidenceAssets, data.evidenceAssets);
      populateMap(memoryStore.notifications, data.notifications);
      populateMap(memoryStore.shiftClosings, data.shiftClosings);
      populateMap(memoryStore.shiftByClientId, data.shiftByClientId);
      populateMap(memoryStore.saleByClientId, data.saleByClientId);
      populateMap(memoryStore.paymentByClientId, data.paymentByClientId);
      populateMap(memoryStore.expenseByClientId, data.expenseByClientId);
      populateMap(memoryStore.locationReportByClientId, data.locationReportByClientId);
      populateMap(memoryStore.closingByClientId, data.closingByClientId);
      populateMap(memoryStore.movementByClientId, data.movementByClientId);
      try {
        globalForStore.__siomayopsLastMtimeMs = fs.statSync(dbPath).mtimeMs;
      } catch {}
    } finally {
      isApplyingFromDisk = false;
    }
    return true;
  } catch {
    isApplyingFromDisk = false;
    return false;
  }
}

// Wrap map mutations to auto-persist
function wrapMapsForPersist() {
  if (globalForStore.__siomayopsWrapped) return;
  const mapKeys: (keyof MemoryStore)[] = [
    "operators","stalls","assignments","sellingLocations","shifts","locationReports","trafficSamples","trafficVideoAssets","trafficSampleByClientId","trafficVideoByClientId",
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
  const origPush = memoryStore.auditEvents.push.bind(memoryStore.auditEvents);
  (memoryStore.auditEvents as any).push = (...args: any[]) => { const r = origPush(...args); persistStore(); return r; };
  globalForStore.__siomayopsWrapped = true;
}

// Deterministic seed for POS vertical slice
export function toJakartanBusinessDay(now: Date): string {
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

export function ensureSeed() {
  const ORG = "00000000-0000-7000-0000-000000000001";
  const AREA = "00000000-0000-7000-0000-000000000003";
  const OPERATOR = "00000000-0000-7000-0000-000000000010";
  const OP2 = "00000000-0000-7000-0000-000000000011";
  const STALL = "00000000-0000-7000-0000-000000000020";
  const STALL2 = "00000000-0000-7000-0000-000000000021";
  const LOC = "00000000-0000-7000-0000-000000000030";
  const LOC2 = "00000000-0000-7000-0000-000000000032";
  const now = new Date();
  const businessDay = toJakartanBusinessDay(now);

  let seeded = false;
  const prevApplying = isApplyingFromDisk;
  isApplyingFromDisk = true;
  try {
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

    // Stalls (Outlets)
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
    if (!memoryStore.stalls.has(STALL2)) {
      memoryStore.stalls.set(STALL2, {
        id: STALL2,
        organizationId: ORG,
        areaId: AREA,
        code: "ST-002",
        type: "BOOTH",
        status: "ACTIVE",
        createdAt: now,
      });
      seeded = true;
    }

    // External organization stall for cross-tenant authorization verification
    const EXT_ORG = "00000000-0000-7000-0000-000000000099";
    const EXT_STALL = "00000000-0000-7000-0000-000000000098";
    const EXT_LOC = "00000000-0000-7000-0000-000000000097";
    if (!memoryStore.stalls.has(EXT_STALL)) {
      memoryStore.stalls.set(EXT_STALL, {
        id: EXT_STALL,
        organizationId: EXT_ORG,
        areaId: "00000000-0000-7000-0000-000000000096",
        code: "ST-EXT-99",
        type: "MOBILE",
        status: "ACTIVE",
        createdAt: now,
      });
      memoryStore.sellingLocations.set(EXT_LOC, {
        id: EXT_LOC,
        organizationId: EXT_ORG,
        areaId: "00000000-0000-7000-0000-000000000096",
        name: "Outlet Organisasi Lain",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      seeded = true;
    }

    // Selling locations
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
    if (!memoryStore.sellingLocations.has(LOC2)) {
      memoryStore.sellingLocations.set(LOC2, {
        id: LOC2,
        organizationId: ORG,
        areaId: AREA,
        name: "Cabang Dago Atas",
        addressText: "Jl. Ir. H. Juanda No.88, Bandung",
        lat: -6.885,
        lng: 107.613,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      seeded = true;
    }

    // Assignments
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
    const ASSIGN2 = "00000000-0000-7000-0000-000000000041";
    if (!memoryStore.assignments.has(ASSIGN2)) {
      memoryStore.assignments.set(ASSIGN2, {
        id: ASSIGN2,
        organizationId: ORG,
        operatorId: OP2,
        stallId: STALL2,
        areaId: AREA,
        type: "PRIMARY",
        validFrom: now,
        createdBy: OP2,
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

    // Stock items — 4 items
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

    // Seed OPEN shift 1 for ST-001 (Budi)
    const shiftId1 = "00000000-0000-7000-0000-000000000001";
    if (!memoryStore.shifts.has(shiftId1)) {
      const shift: StoredShift = {
        id: shiftId1,
        organizationId: ORG,
        operatorId: OPERATOR,
        stallId: STALL,
        businessDay,
        startedAt: now,
        startLocationId: LOC,
        openingCashMinor: 50000,
        currency: "IDR",
        status: "OPEN",
        clientShiftId: shiftId1,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.shifts.set(shiftId1, shift);
      memoryStore.shiftByClientId.set(shiftId1, shiftId1);
      const reportId = "00000000-0000-7000-0000-000000000031";
      if (!memoryStore.locationReports.has(reportId)) {
        memoryStore.locationReports.set(reportId, {
          id: reportId,
          organizationId: ORG,
          shiftId: shiftId1,
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
      for (const s of stockSeed) {
        const snapId = `snap-start-${s.id.slice(-4)}`;
        if (!memoryStore.stockSnapshots.has(snapId)) {
          memoryStore.stockSnapshots.set(snapId, {
            id: snapId,
            organizationId: ORG,
            shiftId: shiftId1,
            stockItemId: s.id,
            phase: "START",
            countedQuantity: 40,
            expectedQuantity: 40,
          });
        }
      }
      seeded = true;
    }

    // Seed OPEN shift 2 for ST-002 (Sari)
    const shiftId2 = "00000000-0000-7000-0000-000000000002";
    if (!memoryStore.shifts.has(shiftId2)) {
      const shift2: StoredShift = {
        id: shiftId2,
        organizationId: ORG,
        operatorId: OP2,
        stallId: STALL2,
        businessDay,
        startedAt: now,
        startLocationId: LOC2,
        openingCashMinor: 50000,
        currency: "IDR",
        status: "OPEN",
        clientShiftId: shiftId2,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.shifts.set(shiftId2, shift2);
      memoryStore.shiftByClientId.set(shiftId2, shiftId2);
      const reportId2 = "00000000-0000-7000-0000-000000000033";
      if (!memoryStore.locationReports.has(reportId2)) {
        memoryStore.locationReports.set(reportId2, {
          id: reportId2,
          organizationId: ORG,
          shiftId: shiftId2,
          stallId: STALL2,
          operatorId: OP2,
          sellingLocationId: LOC2,
          trigger: "ARRIVED",
          arrivedAt: now,
          clientReportId: reportId2,
          createdAt: now,
        });
        memoryStore.locationReportByClientId.set(reportId2, reportId2);
      }
      seeded = true;
    }

    // Seed initial baseline completed sales if none exist yet (matching AFTER.md: 2 sales of Rp 30.000 = Rp 60.000)
    if (memoryStore.sales.size === 0) {
      const baselineSales = [
        {
          saleId: "42febc10-0000-7000-8000-000000000301",
          paymentId: "42febc10-0000-7000-8000-000000000401",
          saleItemId: "42febc10-0000-7000-8000-000000000501",
          movId: "42febc10-0000-7000-8000-000000000601",
          occurredAt: new Date(now.getTime() - 25 * 60 * 1000),
          note: "2x Siomay Ayam (Shift Pagi)",
        },
        {
          saleId: "7a3e32e8-0000-7000-8000-000000000302",
          paymentId: "7a3e32e8-0000-7000-8000-000000000402",
          saleItemId: "7a3e32e8-0000-7000-8000-000000000502",
          movId: "7a3e32e8-0000-7000-8000-000000000602",
          occurredAt: new Date(now.getTime() - 10 * 60 * 1000),
          note: "2x Siomay Ayam (Pelanggan Reguler)",
        },
      ];
      for (const bs of baselineSales) {
        memoryStore.sales.set(bs.saleId, {
          id: bs.saleId,
          organizationId: ORG,
          shiftId: shiftId1,
          sellingLocationId: LOC,
          operatorId: OPERATOR,
          stallId: STALL,
          businessDay,
          occurredAt: bs.occurredAt,
          serverAcceptedAt: bs.occurredAt,
          totalMinor: 30000,
          currency: "IDR",
          status: "COMPLETED",
          clientSaleId: bs.saleId,
          note: bs.note,
          customerReference: bs.note,
          version: 2,
          createdAt: bs.occurredAt,
        });
        memoryStore.saleByClientId.set(bs.saleId, bs.saleId);
        memoryStore.saleItems.set(bs.saleItemId, {
          id: bs.saleItemId,
          organizationId: ORG,
          saleId: bs.saleId,
          menuItemId: "00000000-0000-7000-0000-000000000101",
          quantity: 2,
          unitPriceMinor: 15000,
          lineTotalMinor: 30000,
          pricePolicyId: "pp-0101",
        });
        memoryStore.payments.set(bs.paymentId, {
          id: bs.paymentId,
          organizationId: ORG,
          saleId: bs.saleId,
          method: "CASH",
          amountMinor: 30000,
          currency: "IDR",
          status: "PAID",
          clientPaymentId: bs.paymentId,
          createdAt: bs.occurredAt,
          updatedAt: bs.occurredAt,
        });
        memoryStore.paymentByClientId.set(bs.paymentId, bs.paymentId);
        const movClientKey = `sale-${bs.saleId}-00000000-0000-7000-0000-000000000101`;
        if (!memoryStore.movementByClientId.has(movClientKey)) {
          memoryStore.stockMovements.set(bs.movId, {
            id: bs.movId,
            organizationId: ORG,
            stockItemId: "00000000-0000-7000-0000-000000000201",
            stallId: STALL,
            operatorId: OPERATOR,
            shiftId: shiftId1,
            movementType: "SALE",
            quantity: -2,
            occurredAt: bs.occurredAt,
            reason: `sale ${bs.saleId}`,
            actorId: OPERATOR,
            clientMovementId: movClientKey,
          });
          memoryStore.movementByClientId.set(movClientKey, bs.movId);
        }
        memoryStore.auditEvents.push({
          id: `aud-${bs.saleId.slice(0, 8)}`,
          organizationId: ORG,
          actorId: OPERATOR,
          actorKind: "OPERATOR",
          action: "sale.created",
          entityType: "sale",
          entityId: bs.saleId,
          occurredAt: bs.occurredAt,
          newValueJson: JSON.stringify({ total: 30000, stallId: STALL, note: bs.note }),
          requestId: `seed-${bs.saleId.slice(0, 8)}`,
        });
      }
      seeded = true;
    }
  } finally {
    isApplyingFromDisk = prevApplying;
  }

  if (seeded) persistStore();
}

export function syncFromDiskIfNeeded(): void {
  const dbPath = getDbPath();
  if (!dbPath) return;
  try {
    if (fs.existsSync(dbPath)) {
      const mtimeMs = fs.statSync(dbPath).mtimeMs;
      if (
        globalForStore.__siomayopsLastMtimeMs === undefined ||
        mtimeMs > globalForStore.__siomayopsLastMtimeMs ||
        memoryStore.operators.size === 0
      ) {
        loadStore();
        if (memoryStore.operators.size === 0) {
          ensureSeed();
        }
      }
    } else if (memoryStore.operators.size === 0) {
      ensureSeed();
    }
  } catch {}
}

export function reloadStoreFromDisk(): boolean {
  const ok = loadStore();
  if (memoryStore.operators.size === 0) {
    ensureSeed();
  }
  return ok;
}

export const GPS_SAMPLE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const TRAFFIC_VIDEO_RETENTION_MS = 24 * 60 * 60 * 1000;
export const TRAFFIC_SAMPLE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;


/** Scrub only the precise GPS fields; retain the operational selling-point report. */
export function purgeExpiredGpsSamples(now = new Date()): number {
  const cutoff = now.getTime() - GPS_SAMPLE_RETENTION_MS;
  let purged = 0;
  for (const [id, report] of memoryStore.locationReports) {
    if (!report.gpsSample) continue;
    const capturedAt = report.gpsSample.capturedAt;
    const timestamp = capturedAt instanceof Date ? capturedAt.getTime() : Number.NaN;
    if (!Number.isFinite(timestamp) || timestamp <= cutoff) {
      const { gpsSample: _expiredSample, ...operationalReport } = report;
      memoryStore.locationReports.set(id, operationalReport);
      purged += 1;
    }
  }
  return purged;
}

// Initialize persistence
wrapMapsForPersist();
if (getDbPath()) {
  const loaded = loadStore();
  ensureSeed();
  if (!loaded) persistStore();
}
purgeExpiredGpsSamples();

// Helpers
export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function idempotencyMapKey(orgId: string, route: string, key: string): string {
  return `${orgId}|${route}|${key}`;
}

// expose persist for explicit calls
export function persistNow() { persistStore(); }
