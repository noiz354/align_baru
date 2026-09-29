/**
 * Indonesian presentation copy for the HQ dashboard.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. The read model returns
 * structured types and numbers only; every human-readable string lives here, so wording can
 * change without touching the read model (HQ-DASHBOARD.md §3, "alert wording rule").
 */

import type {
  ActivityEntry,
  AlertSeverity,
  DashboardAlert,
  DashboardAlertType,
  DashboardException,
  ExceptionType,
  OutletStatus,
} from "@/features/hq/dashboard-read-model";
import { formatMoneyForOperator, money } from "@/shared/money/money";
import { formatHours, formatJakartaTime } from "./format";

export const EMPTY_ALERTS_MESSAGE = "Tidak ada perhatian khusus saat ini.";
export const EMPTY_ACTIVITY_MESSAGE = "Belum ada aktivitas operasional pada tanggal ini.";
export const EMPTY_OUTLETS_MESSAGE = "Tidak ada outlet dalam scope ini.";
export const NO_VALUE = "—";

const ALERT_TITLES: Record<DashboardAlertType, string> = {
  OUTLET_NOT_STARTED: "Belum memulai operasional",
  SHIFT_WITHOUT_LOCATION_REPORT: "Shift aktif tanpa laporan lokasi",
  UNVERIFIED_DIGITAL_PAYMENT: "Pembayaran digital belum diverifikasi",
  CASH_VARIANCE_BEYOND_TOLERANCE: "Selisih kas melebihi toleransi",
  UNRESOLVED_VERIFICATIONS_AT_CLOSING: "Verifikasi belum selesai saat tutup shift",
  EXPENSE_PATTERN_FLAGGED: "Pengeluaran ditandai untuk review",
  INCIDENT_OPEN: "Insiden belum selesai",
  STOCK_LOW: "Stok menipis",
  STOCK_OUT: "Stok habis",
  RESTOCK_REQUEST: "Permintaan restock",
  UNCLASSIFIED: "Peringatan tercatat",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  INFO: "Info",
  ATTENTION: "Perlu perhatian",
  BLOCKING: "Menghambat",
  SECURITY: "Keamanan",
};

const OUTLET_STATUS_LABELS: Record<OutletStatus, string> = {
  NOT_STARTED: "Belum mulai",
  OPEN: "Buka",
  SUSPENDED: "Ditangguhkan",
  CLOSING_SUBMITTED: "Tutup terkirim",
  CLOSED: "Tutup",
  VOID: "Dibatalkan",
  INACTIVE: "Tidak aktif",
};

const ACTIVITY_PHRASES: Record<string, string> = {
  "sale.created": "mencatat penjualan",
  "sale.voided": "membatalkan penjualan",
  "sale.corrected": "mengoreksi penjualan",
  "shift.started": "memulai shift",
  "shift.suspended": "menangguhkan shift",
  "shift.closed": "menutup shift",
  "shift.handover": "serah terima shift",
  "location.reported": "melaporkan lokasi",
  "location.moved": "berpindah lokasi",
  "location.status_changed": "mengubah status lokasi",
  "payment.recorded": "mencatat pembayaran",
  "payment.verified": "memverifikasi pembayaran",
  "payment.reconciled": "merekonsiliasi pembayaran",
  "payment.callback_rejected": "menolak callback pembayaran",
  "expense.submitted": "mencatat pengeluaran",
  "expense.reviewed": "mereview pengeluaran",
  "expense.rejected": "menolak pengeluaran",
  "expense.escalated": "mengeskalasi pengeluaran",
  "expense.flagged": "menandai pengeluaran",
  "stock.movement": "mencatat pergerakan stok",
  "stock.count_submitted": "mengirim hitung stok",
  "stock.transfer": "transfer stok",
  "price.policy_published": "menerbitkan kebijakan harga",
  "price.override_requested": "mengajukan override harga",
  "price.override_applied": "menerapkan override harga",
  "price.acknowledged": "mengakui harga baru",
  "menu.item_upserted": "memperbarui menu",
  "menu.availability_changed": "mengubah ketersediaan menu",
  "operator.created": "menambah operator",
  "operator.status_changed": "mengubah status operator",
  "operator.capabilities_changed": "mengubah kemampuan operator",
  "assignment.created": "membuat penugasan",
  "incident.submitted": "melaporkan insiden",
  "incident.transitioned": "memperbarui insiden",
  "loyalty.identified": "mengidentifikasi pelanggan",
  "loyalty.earned": "memberi poin loyalitas",
  "loyalty.redeemed": "menukar reward",
  "loyalty.consent_withdrawn": "mencabut persetujuan loyalitas",
  "authz.denied": "akses ditolak",
  "auth.session_revoked": "mencabut sesi",
  "auth.device_revoked": "mencabut perangkat",
  "config.changed": "mengubah konfigurasi",
  "export.created": "membuat ekspor",
  "retention.executed": "menjalankan retensi data",
  "audit.queried": "menelusuri jejak audit",
};

const SUBJECT_LABELS: Record<string, string> = {
  shift: "Shift",
  sale: "Penjualan",
  sale_item: "Item penjualan",
  payment: "Pembayaran",
  expense: "Pengeluaran",
  stock_item: "Item stok",
  stock_movement: "Pergerakan stok",
  stock_snapshot: "Hitung stok",
  closing: "Tutup shift",
  location: "Lokasi",
  operator: "Operator",
  assignment: "Penugasan",
  incident: "Insiden",
  price_policy: "Kebijakan harga",
  menu_item: "Menu",
  loyalty_account: "Akun loyalitas",
  restock_request: "Permintaan restock",
  audit: "Audit",
};

const EXCEPTION_TITLES: Record<ExceptionType, string> = {
  PAYMENT_UNVERIFIED: "Pembayaran belum diverifikasi",
  EXPENSE_FLAGGED: "Pengeluaran ditandai",
  INCIDENT_OPEN: "Insiden terbuka",
};

export function alertTitle(type: DashboardAlertType): string {
  return ALERT_TITLES[type] ?? ALERT_TITLES.UNCLASSIFIED;
}

export function severityLabel(severity: AlertSeverity): string {
  return SEVERITY_LABELS[severity];
}

export function outletStatusLabel(status: OutletStatus): string {
  return OUTLET_STATUS_LABELS[status];
}

/** Human-readable reason for an alert; numbers only, no invented causes. */
export function alertDetail(alert: DashboardAlert): string {
  const parts: string[] = [];
  if (alert.context.amountMinor !== undefined) {
    parts.push(formatMoneyForOperator(money(alert.context.amountMinor, "IDR")));
  }
  if (alert.context.quantity !== undefined) {
    parts.push(`${alert.context.quantity} transaksi tercatat`);
  }
  if (alert.context.ageHours !== undefined) {
    parts.push(`usia ${formatHours(alert.context.ageHours)}`);
  }
  if (alert.context.code) parts.push(alert.context.code);
  if (alert.sourceType && alert.type === "UNCLASSIFIED") parts.push(alert.sourceType);
  if (alert.occurredAt) parts.push(`sejak ${formatJakartaTime(alert.occurredAt)}`);
  return parts.join(" • ");
}

/** Indonesian phrase for an audit event; unknown actions degrade to a neutral statement. */
export function activityPhrase(eventType: string): string {
  return ACTIVITY_PHRASES[eventType] ?? "mencatat aktivitas operasional";
}

export function activitySubjectLabel(subjectKind: string): string {
  return SUBJECT_LABELS[subjectKind] ?? "Catatan";
}

export function activitySummary(entry: ActivityEntry): string {
  return `${activityPhrase(entry.eventType)} • ${activitySubjectLabel(entry.subjectKind)}`;
}

export function exceptionTitle(type: ExceptionType): string {
  return EXCEPTION_TITLES[type] ?? "Perlu ditinjau";
}

export function exceptionDetail(exception: DashboardException): string {
  const parts: string[] = [];
  if (exception.amountMinor !== undefined) {
    parts.push(formatMoneyForOperator(money(exception.amountMinor, "IDR")));
  }
  if (exception.ageHours !== undefined) parts.push(`usia ${formatHours(exception.ageHours)}`);
  return parts.join(" • ");
}
