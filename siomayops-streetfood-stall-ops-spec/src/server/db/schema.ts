/**
 * Drizzle schema definitions (Postgres) for SiomayOps.
 * This is the authoritative schema for migrations, while runtime uses in-memory store for pilot implementation.
 * All tables carry organization_id and appropriate constraints per DATA_MODEL.md and ADR-0031/0032.
 */

import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";

// Helper for common columns
const orgId = uuid("organization_id").notNull();
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  currency: text("currency").notNull().default("IDR"),
  createdAt,
});

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("regions_org_code_unique").on(t.organizationId, t.code),
  index("regions_org_idx").on(t.organizationId),
]);

export const areas = pgTable("areas", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  regionId: uuid("region_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  supervisorOperatorId: uuid("supervisor_operator_id"),
  createdAt,
}, (t) => [
  uniqueIndex("areas_org_code_unique").on(t.organizationId, t.code),
  index("areas_org_idx").on(t.organizationId),
]);

export const operators = pgTable("operators", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  areaId: uuid("area_id").notNull(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull(),
  contractType: text("contract_type").notNull(),
  trainingState: text("training_state").notNull(),
  status: text("status").notNull(),
  startedOn: text("started_on"),
  active: boolean("active").notNull().default(true),
  createdAt,
  updatedAt,
}, (t) => [
  uniqueIndex("operators_org_phone_unique").on(t.organizationId, t.phoneE164),
  index("operators_org_idx").on(t.organizationId),
]);

export const stalls = pgTable("stalls", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  areaId: uuid("area_id").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt,
}, (t) => [
  uniqueIndex("stalls_org_code_unique").on(t.organizationId, t.code),
  index("stalls_org_idx").on(t.organizationId),
]);

export const operatorAssignments = pgTable("operator_assignments", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  operatorId: uuid("operator_id").notNull(),
  stallId: uuid("stall_id").notNull(),
  areaId: uuid("area_id").notNull(),
  type: text("type").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  createdAt,
}, (t) => [
  index("assignments_org_idx").on(t.organizationId),
  index("assignments_stall_idx").on(t.stallId),
]);

export const sellingLocations = pgTable("selling_locations", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  areaId: uuid("area_id").notNull(),
  name: text("name").notNull(),
  addressText: text("address_text"),
  lat: text("lat"),
  lng: text("lng"),
  landmark: text("landmark"),
  windowsJson: jsonb("windows_json"),
  usualFeeNote: text("usual_fee_note"),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt,
  updatedAt,
}, (t) => [
  index("selling_locations_org_idx").on(t.organizationId),
  index("selling_locations_area_idx").on(t.areaId),
]);

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  operatorId: uuid("operator_id").notNull(),
  stallId: uuid("stall_id").notNull(),
  businessDay: text("business_day").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  startLocationId: uuid("start_location_id").notNull(),
  endLocationId: uuid("end_location_id"),
  openingCashMinor: integer("opening_cash_minor").notNull(),
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull(),
  clientShiftId: uuid("client_shift_id").notNull(),
  version: integer("version").notNull().default(1),
  createdAt,
  updatedAt,
}, (t) => [
  uniqueIndex("shifts_org_client_unique").on(t.organizationId, t.clientShiftId),
  index("shifts_org_operator_idx").on(t.organizationId, t.operatorId),
  index("shifts_org_business_day_idx").on(t.organizationId, t.businessDay),
]);

export const locationReports = pgTable("location_reports", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id").notNull(),
  stallId: uuid("stall_id").notNull(),
  operatorId: uuid("operator_id").notNull(),
  sellingLocationId: uuid("selling_location_id").notNull(),
  trigger: text("trigger").notNull(),
  reasonForMove: text("reason_for_move"),
  note: text("note"),
  gpsLatitude: doublePrecision("gps_latitude"),
  gpsLongitude: doublePrecision("gps_longitude"),
  gpsAccuracyMeters: doublePrecision("gps_accuracy_meters"),
  gpsCapturedAt: timestamp("gps_captured_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull(),
  departedAt: timestamp("departed_at", { withTimezone: true }),
  clientReportId: uuid("client_report_id").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("location_reports_org_client_unique").on(t.organizationId, t.clientReportId),
  index("location_reports_shift_idx").on(t.shiftId),
  index("location_reports_gps_captured_idx").on(t.gpsCapturedAt),
]);

export const trafficSamples = pgTable("traffic_samples", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  sellingLocationId: uuid("selling_location_id").notNull(),
  sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
  estimatedCount: integer("estimated_count").notNull(),
  trafficBand: text("traffic_band").notNull(),
  note: text("note"),
  clientRequestId: uuid("client_request_id").notNull(),
  videoAssetId: uuid("video_asset_id"),
  videoStatus: text("video_status").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("traffic_samples_org_client_unique").on(t.organizationId, t.clientRequestId),
  index("traffic_samples_location_time_idx").on(t.organizationId, t.sellingLocationId, t.sampledAt),
]);

export const trafficVideoAssets = pgTable("traffic_video_assets", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  sellingLocationId: uuid("selling_location_id").notNull(),
  sampleId: uuid("sample_id"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  durationMs: integer("duration_ms").notNull(),
  privateStorageKey: text("private_storage_key").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("traffic_video_assets_sample_unique").on(t.organizationId, t.sampleId),
  index("traffic_video_assets_expiry_idx").on(t.expiresAt),
]);

export const menuCategories = pgTable("menu_categories", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt,
}, (t) => [
  index("menu_categories_org_idx").on(t.organizationId),
]);

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  categoryId: uuid("category_id").notNull(),
  name: text("name").notNull(),
  portionNote: text("portion_note"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull(),
  createdAt,
}, (t) => [
  index("menu_items_org_idx").on(t.organizationId),
]);

export const pricePolicies = pgTable("price_policies", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  menuItemId: uuid("menu_item_id").notNull(),
  scope: text("scope").notNull(),
  scopeId: uuid("scope_id").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  currency: text("currency").notNull().default("IDR"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  reason: text("reason").notNull(),
  createdBy: uuid("created_by").notNull(),
  approvedBy: uuid("approved_by"),
  createdAt,
}, (t) => [
  index("price_policies_org_menu_idx").on(t.organizationId, t.menuItemId),
  index("price_policies_scope_idx").on(t.scope, t.scopeId),
]);

export const priceAcknowledgements = pgTable("price_acknowledgements", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  operatorId: uuid("operator_id").notNull(),
  priceSetDigest: text("price_set_digest").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull(),
  createdAt,
}, (t) => [
  index("price_ack_org_operator_idx").on(t.organizationId, t.operatorId),
]);

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id").notNull(),
  sellingLocationId: uuid("selling_location_id").notNull(),
  operatorId: uuid("operator_id").notNull(),
  stallId: uuid("stall_id").notNull(),
  businessDay: text("business_day").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  serverAcceptedAt: timestamp("server_accepted_at", { withTimezone: true }).notNull(),
  totalMinor: integer("total_minor").notNull(),
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull(),
  clientSaleId: uuid("client_sale_id").notNull(),
  version: integer("version").notNull().default(1),
  createdAt,
}, (t) => [
  uniqueIndex("sales_org_client_unique").on(t.organizationId, t.clientSaleId),
  index("sales_shift_idx").on(t.shiftId),
  index("sales_business_day_idx").on(t.organizationId, t.businessDay),
]);

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  saleId: uuid("sale_id").notNull(),
  menuItemId: uuid("menu_item_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  lineTotalMinor: integer("line_total_minor").notNull(),
  pricePolicyId: uuid("price_policy_id"),
  createdAt,
}, (t) => [
  index("sale_items_sale_idx").on(t.saleId),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  saleId: uuid("sale_id").notNull(),
  method: text("method").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull(),
  providerReference: text("provider_reference"),
  verifiedBy: uuid("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  clientPaymentId: uuid("client_payment_id").notNull(),
  createdAt,
  updatedAt,
}, (t) => [
  uniqueIndex("payments_org_client_unique").on(t.organizationId, t.clientPaymentId),
  index("payments_sale_idx").on(t.saleId),
]);

export const paymentCallbacks = pgTable("payment_callbacks", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  paymentId: uuid("payment_id"),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  rawPayloadJson: text("raw_payload_json").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("payment_callbacks_dedupe_unique").on(t.organizationId, t.dedupeKey),
  index("payment_callbacks_provider_ref_idx").on(t.provider, t.providerReference),
]);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id").notNull(),
  operatorId: uuid("operator_id").notNull(),
  sellingLocationId: uuid("selling_location_id"),
  category: text("category").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("IDR"),
  description: text("description").notNull(),
  note: text("note"),
  paidFrom: text("paid_from").notNull(),
  evidenceObjectKey: text("evidence_object_key"),
  reviewStatus: text("review_status").notNull(),
  flaggedReason: text("flagged_reason"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  clientExpenseId: uuid("client_expense_id").notNull(),
  incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("expenses_org_client_unique").on(t.organizationId, t.clientExpenseId),
  index("expenses_shift_idx").on(t.shiftId),
]);

export const stockItems = pgTable("stock_items", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt,
}, (t) => [
  uniqueIndex("stock_items_org_code_unique").on(t.organizationId, t.code),
]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  stockItemId: uuid("stock_item_id").notNull(),
  stallId: uuid("stall_id"),
  operatorId: uuid("operator_id"),
  shiftId: uuid("shift_id"),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  actorId: uuid("actor_id").notNull(),
  clientMovementId: uuid("client_movement_id").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("stock_movements_org_client_unique").on(t.organizationId, t.clientMovementId),
  index("stock_movements_stall_item_idx").on(t.stallId, t.stockItemId),
]);

export const stockSnapshots = pgTable("stock_snapshots", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id").notNull(),
  stockItemId: uuid("stock_item_id").notNull(),
  phase: text("phase").notNull(),
  countedQuantity: integer("counted_quantity"),
  expectedQuantity: integer("expected_quantity"),
  varianceQuantity: integer("variance_quantity"),
  reason: text("reason"),
  createdAt,
}, (t) => [
  index("stock_snapshots_shift_idx").on(t.shiftId),
]);

export const shiftClosings = pgTable("shift_closings", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  openingCashMinor: integer("opening_cash_minor").notNull(),
  cashSalesMinor: integer("cash_sales_minor").notNull(),
  cashExpensesMinor: integer("cash_expenses_minor").notNull(),
  expectedCashMinor: integer("expected_cash_minor").notNull(),
  countedCashMinor: integer("counted_cash_minor").notNull(),
  cashVarianceMinor: integer("cash_variance_minor").notNull(),
  digitalExpectedMinor: integer("digital_expected_minor").notNull().default(0),
  digitalReceivedMinor: integer("digital_received_minor").notNull().default(0),
  notes: text("notes"),
  status: text("status").notNull(),
  clientClosingId: uuid("client_closing_id").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("shift_closings_org_client_unique").on(t.organizationId, t.clientClosingId),
  uniqueIndex("shift_closings_shift_unique").on(t.shiftId),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  actorId: uuid("actor_id"),
  actorKind: text("actor_kind").notNull(),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  previousValueJson: text("previous_value_json"),
  newValueJson: text("new_value_json"),
  reason: text("reason"),
  requestId: text("request_id").notNull(),
  ipHash: text("ip_hash"),
  createdAt,
}, (t) => [
  index("audit_events_org_entity_idx").on(t.organizationId, t.entityType, t.entityId),
  index("audit_events_org_time_idx").on(t.organizationId, t.occurredAt),
]);

export const idempotencyRecords = pgTable("idempotency_records", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  route: text("route").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  responseJson: text("response_json").notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt,
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("idempotency_org_route_key_unique").on(t.organizationId, t.route, t.idempotencyKey),
]);

export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  phoneE164: text("phone_e164"),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt,
}, (t) => [
  index("loyalty_accounts_org_idx").on(t.organizationId),
]);

export const rewardInstances = pgTable("reward_instances", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  loyaltyAccountId: uuid("loyalty_account_id").notNull(),
  rewardDefinitionId: uuid("reward_definition_id").notNull(),
  periodKey: text("period_key").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  redeemedSaleId: uuid("redeemed_sale_id"),
  createdAt,
}, (t) => [
  uniqueIndex("reward_instances_one_per_account_def_period").on(t.loyaltyAccountId, t.rewardDefinitionId, t.periodKey),
  index("reward_instances_account_idx").on(t.loyaltyAccountId),
]);

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey(),
  organizationId: orgId,
  shiftId: uuid("shift_id"),
  operatorId: uuid("operator_id").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  createdAt,
  updatedAt,
}, (t) => [
  index("incidents_org_idx").on(t.organizationId),
]);

export const SCHEMA_IS_INTENTIONALLY_EMPTY_IN_PHASE_0 = false;
