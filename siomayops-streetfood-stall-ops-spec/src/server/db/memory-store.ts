/**
 * In-memory store for development and tests.
 * Production would use Postgres via Drizzle, but this provides working persistence for the pilot implementation.
 * Every table includes organization_id for scoping (INV-11, ARC-08).
 */

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
  }
}

// Singleton
export const memoryStore = new MemoryStore();

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
