/**
 * KPI tiles — the seven headline figures bound to `readModel.kpis`.
 *
 * Documented in `docs/integration/04-dashboard-ui-integration.md`. Values arrive already
 * computed; this component only formats them (money through `MoneyText`, ratios through
 * `formatPercent`). A value that cannot be computed renders the established dash, never a zero.
 */

import type { DashboardKpis } from "@/features/hq/dashboard-read-model";
import { MoneyText } from "@/shared/ui/MoneyText";
import { formatCount, formatPercent } from "../_lib/format";

export interface KpiTilesProps {
  readonly kpis: DashboardKpis;
}

function Tile({ label, children, detail }: { label: string; children: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: "#111827" }}>{children}</div>
      {detail ? <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{detail}</div> : null}
    </div>
  );
}

export function KpiTiles({ kpis }: KpiTilesProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      <Tile
        label="Penjualan Hari Ini"
        detail={
          <span style={{ display: "grid", gap: 2 }}>
            <span>
              Tunai <MoneyText value={kpis.grossByMethod.cash} density="hq" />
            </span>
            <span>
              Digital terverifikasi <MoneyText value={kpis.grossByMethod.digitalVerified} density="hq" />
            </span>
            <span style={{ color: "#d97706" }}>
              Digital belum verifikasi <MoneyText value={kpis.grossByMethod.digitalUnverified} density="hq" emphasis="waiting" />
            </span>
            <span style={{ color: "#9ca3af" }}>Angka utama hanya penjualan selesai; digital belum verifikasi bukan pendapatan terverifikasi.</span>
          </span>
        }
      >
        <MoneyText value={kpis.salesToday} density="hq" />
      </Tile>

      <Tile label="Transaksi" detail={`${formatCount(kpis.transactionCount)} penjualan selesai`}>
        {formatCount(kpis.transactionCount)}
      </Tile>

      <Tile label="Rata-rata Transaksi" detail={kpis.averageTransaction ? undefined : "Belum ada transaksi"}>
        {kpis.averageTransaction ? <MoneyText value={kpis.averageTransaction} density="hq" /> : "—"}
      </Tile>

      <Tile label="Pengeluaran" detail="Pengeluaran lapangan pada hari operasional ini">
        <MoneyText value={kpis.expenses} density="hq" />
      </Tile>

      <Tile label="Rasio Pengeluaran" detail={kpis.expenseRatioPercent === null ? "Butuh penjualan untuk dihitung" : "Terhadap penjualan"}>
        {formatPercent(kpis.expenseRatioPercent)}
      </Tile>

      <Tile label="Outlet Aktif" detail={`dari ${formatCount(kpis.totalOutlets)} outlet aktif`}>
        {formatCount(kpis.activeOutlets)}
      </Tile>

      <Tile label="Total Outlet" detail="Outlet dalam scope Anda">
        {formatCount(kpis.totalOutlets)}
      </Tile>
    </div>
  );
}
