// Presentation helpers for the HQ dashboard. The read model returns raw integers and ISO
// timestamps (IDR minor unit == rupiah); every string a person reads is produced here.
import type { HqDashboardActivity, HqDashboardAlert, OutletStatus } from "@/features/hq/dashboard";

export const rupiah = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

export function compactRupiah(value: number): string {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const formatClock = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? clock.format(date) : "—";
};

// A business day is a plain YYYY-MM-DD label; noon UTC keeps the calendar date stable in any zone.
const dayAt = (day: string) => new Date(`${day}T12:00:00Z`);
export const formatLongDay = (day: string): string =>
  dayAt(day).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatShortDay = (day: string): string =>
  dayAt(day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDayMonth = (day: string): string =>
  dayAt(day).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatBps = (bps: number): string =>
  `${(bps / 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export interface ChartPoint { readonly label: string; readonly x: number; readonly y: number; readonly value: number }
export interface ChartGeometry { readonly points: readonly ChartPoint[]; readonly yLabels: readonly string[]; readonly max: number }

const CHART_WIDTH = 700;
const CHART_BASE = 145;
const CHART_SPAN = 118;

/** Round a maximum up to a readable axis ceiling (1, 2, 2.5, 5 × 10ⁿ). Zero data gets a neutral axis. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1_000_000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * magnitude) return step * magnitude;
  return 10 * magnitude;
}

export function chartGeometry(trend: readonly { label: string; cumulativeMinor: number }[]): ChartGeometry {
  const max = niceCeiling(Math.max(0, ...trend.map((point) => point.cumulativeMinor)));
  const last = Math.max(1, trend.length - 1);
  const points = trend.map((point, index) => ({
    label: point.label,
    value: point.cumulativeMinor,
    x: Math.round((index / last) * CHART_WIDTH),
    y: Math.round(CHART_BASE - (point.cumulativeMinor / max) * CHART_SPAN),
  }));
  const yLabels = [1, 0.75, 0.5, 0.25, 0].map((ratio) => (ratio === 0 ? "Rp 0" : compactRupiah(max * ratio)));
  return { points, yLabels, max };
}

export const STATUS_PRESENTATION: Record<OutletStatus, { label: string; className: string }> = {
  OPERATING: { label: "Beroperasi", className: "status-operating" },
  ATTENTION: { label: "Perlu Perhatian", className: "status-attention" },
  REVIEW: { label: "Periksa", className: "status-review" },
  NOT_STARTED: { label: "Belum Mulai", className: "status-notstarted" },
  CLOSED: { label: "Tidak Aktif", className: "status-notstarted" },
};

export interface AlertPresentation { readonly tag: string; readonly tone: "red" | "amber" | "yellow"; readonly icon: "clock" | "warning" | "box"; readonly action: string }

export function presentAlert(alert: Pick<HqDashboardAlert, "kind" | "severity">): AlertPresentation {
  const tone = alert.severity === "CRITICAL" ? "red" : alert.severity === "WARNING" ? "amber" : "yellow";
  switch (alert.kind) {
    case "SHIFT_LOCATION_MISSING": return { tag: "Tanpa Lokasi", tone, icon: "clock", action: "Lihat outlet" };
    case "FLAGGED_EXPENSE": return { tag: "Periksa", tone, icon: "warning", action: "Tinjau pengeluaran" };
    case "INCIDENT": return { tag: "Insiden", tone, icon: "warning", action: "Lihat insiden" };
    case "RECORDED_ALERT": return { tag: "Peringatan", tone, icon: "warning", action: "Lihat detail" };
    default: return { tag: "Perhatian", tone, icon: "warning", action: "Lihat detail" };
  }
}

/** Only link to destinations that exist in this app; unknown hrefs fall back to the outlet detail. */
export function alertHref(alert: Pick<HqDashboardAlert, "href" | "outletId">, day: string): string | null {
  if (alert.href && (alert.href.startsWith("/hq/outlets/") || alert.href.startsWith("/hq/incidents"))) return alert.href;
  if (alert.outletId) return `/hq/outlets/${encodeURIComponent(alert.outletId)}?date=${day}`;
  return null;
}

export const ACTIVITY_ICON: Record<HqDashboardActivity["kind"], "receipt" | "wallet" | "check" | "box"> = {
  SALE: "receipt", EXPENSE: "wallet", SHIFT: "check", PRODUCT: "box", OTHER: "box",
};
export const ACTIVITY_TONE: Record<HqDashboardActivity["kind"], string> = {
  SALE: "timeline-sale", EXPENSE: "timeline-expense", SHIFT: "timeline-start", PRODUCT: "timeline-product", OTHER: "timeline-product",
};

export function buildQuery(params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : "";
}
