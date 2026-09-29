/**
 * Sales trend chart — bound to `readModel.salesTrend`.
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`.
 *
 * Contract (see the read model): the model always returns the full business-day bucket set in
 * chronological order, so the axis is stable. A day with no sales renders a flat zero line plus
 * an explicit empty message — the chart never invents a trend. Sales that could not be placed on
 * the hour axis (device clock outside the business-day window) are reported as a caption instead
 * of being silently dropped or guessed into a bucket.
 */

import type { SalesTrend } from "@/features/hq/dashboard-read-model";
import { MoneyText } from "@/shared/ui/MoneyText";
import { formatHourLabel } from "../_lib/format";

export interface SalesTrendChartProps {
  readonly trend: SalesTrend;
  readonly emptyMessage: string;
}

const CHART_HEIGHT = 140;

export function SalesTrendChart({ trend, emptyMessage }: SalesTrendChartProps) {
  const peak = trend.points.reduce((max, point) => Math.max(max, point.total.amountMinor), 0);
  const hasActivity = trend.points.some((point) => point.transactionCount > 0);
  const busiest = trend.points.reduce<{ hourLocal: number; totalMinor: number; count: number } | null>((best, point) => {
    if (point.transactionCount === 0) return best;
    if (!best || point.total.amountMinor > best.totalMinor) {
      return { hourLocal: point.hourLocal, totalMinor: point.total.amountMinor, count: point.transactionCount };
    }
    return best;
  }, null);
  const totalMinor = trend.points.reduce((sum, point) => sum + point.total.amountMinor, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: "#374151" }}>
          Total grafik <MoneyText value={{ __brand: "Money", amountMinor: totalMinor, currency: "IDR" }} density="hq" />
        </div>
        {busiest ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Jam tersibuk {formatHourLabel(busiest.hourLocal)} ({busiest.count} transaksi)
          </div>
        ) : null}
      </div>

      <div
        role="img"
        aria-label={`Tren penjualan per jam pada hari operasional ini. ${hasActivity ? `Total Rp ${totalMinor.toLocaleString("id-ID")}.` : "Belum ada transaksi."}`}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: CHART_HEIGHT,
          padding: "0 2px",
          borderBottom: hasActivity ? "1px solid #e5e7eb" : "2px solid #d1d5db",
          background: "linear-gradient(#f9fafb, #ffffff)",
          borderRadius: "8px 8px 0 0",
        }}
      >
        {trend.points.map((point) => {
          const ratio = peak > 0 ? point.total.amountMinor / peak : 0;
          return (
            <div
              key={point.bucketStart}
              title={`${formatHourLabel(point.hourLocal)} • ${point.transactionCount} transaksi`}
              style={{
                flex: 1,
                height: ratio > 0 ? `${Math.max(ratio * 100, 2)}%` : 0,
                background: "#0f766e",
                opacity: point.transactionCount > 0 ? 1 : 0.15,
                borderRadius: "3px 3px 0 0",
              }}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {trend.points.map((point) => (
          <div key={`label-${point.bucketStart}`} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#9ca3af" }}>
            {point.hourLocal % 4 === 0 ? formatHourLabel(point.hourLocal) : ""}
          </div>
        ))}
      </div>

      {!hasActivity ? (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280" }}>{emptyMessage}</p>
      ) : null}
      {trend.unbucketedCount > 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#92400e" }}>
          {trend.unbucketedCount} transaksi terjadi di luar rentang jam hari operasional ini dan hanya
          masuk ke total KPI, bukan ke grafik.
        </p>
      ) : null}
    </div>
  );
}
