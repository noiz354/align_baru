/**
 * The HQ dashboard surface.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. This component renders a
 * read model that the authenticated server boundary already produced: it formats numbers and maps
 * structured types to Indonesian copy, and it computes no operational figure of its own.
 *
 * The layout keeps the design language of the previous HQ page: a max-1200 column, a title block
 * with a freshness badge, and white cards with 1px `#e5e7eb` borders on a `#f9fafb` background.
 */

import type { HqDashboardReadModel } from "@/features/hq/dashboard-read-model";
import { FreshnessBadge } from "@/shared/ui/FreshnessBadge";
import { MoneyText } from "@/shared/ui/MoneyText";
import { ActivityFeed } from "./activity-feed";
import { AlertsPanel } from "./alerts-panel";
import { DashboardFilters } from "./dashboard-filters";
import { KpiTiles } from "./kpi-tiles";
import { OutletTable } from "./outlet-table";
import { CardEmpty, CardRow, SectionCard } from "./section-card";
import { SalesTrendChart } from "./sales-trend-chart";
import { exceptionDetail, exceptionTitle } from "../_lib/copy";
import { formatBusinessDay, formatCount, formatHours, formatJakartaTime } from "../_lib/format";

export interface DashboardViewProps {
  readonly model: HqDashboardReadModel;
}

export function DashboardView({ model }: DashboardViewProps) {
  const outletCodes: Record<string, string> = {};
  for (const outlet of model.outlets.value) outletCodes[outlet.outletId] = outlet.code;

  const stockItems = model.stockStatus.value.items.slice(0, 4);
  const exceptions = model.exceptions.value;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16, background: "#f9fafb", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>HQ Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Data tersimpan untuk {formatBusinessDay(model.businessDay)}
            {model.scope.outletId ? ` • outlet ${outletCodes[model.scope.outletId] ?? model.scope.outletId}` : " • semua outlet"}
            {" • baca saja"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, flexWrap: "wrap" }}>
          <FreshnessBadge computedAt={new Date(model.kpis.computedAt)} band={model.kpis.freshnessBand} />
          <a href="/" style={{ fontSize: 14, color: "#0f766e", fontWeight: 600 }}>← Operator</a>
        </div>
      </header>

      <DashboardFilters
        businessDay={model.businessDay}
        selectedOutletId={model.scope.outletId}
        outlets={model.outlets.value}
      />

      <section style={{ marginTop: 16 }}>
        <KpiTiles kpis={model.kpis.value} />
      </section>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        }}
      >
        <SectionCard
          title="Tren Penjualan per Jam"
          section={model.salesTrend}
          wide
          note="Rentang 04:00 – 03:59 waktu Jakarta. Grafik selalu menampilkan seluruh bucket hari operasional, termasuk saat tidak ada transaksi."
        >
          <SalesTrendChart trend={model.salesTrend.value} emptyMessage="Belum ada transaksi pada tanggal ini." />
        </SectionCard>

        <SectionCard title="Perlu Perhatian" section={model.alerts}>
          <AlertsPanel alerts={model.alerts.value} />
        </SectionCard>

        <SectionCard title="Aktivitas Terbaru" section={model.recentActivity}>
          <ActivityFeed entries={model.recentActivity.value} outletCodes={outletCodes} />
        </SectionCard>

        <SectionCard title="Outlet" section={model.outlets} wide>
          <OutletTable outlets={model.outlets.value} />
        </SectionCard>
      </section>

      <h2 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700 }}>Kartu operasional</h2>
      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        <SectionCard title="Coverage Hari Ini" section={model.coverage}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Shift aktif">{formatCount(model.coverage.value.shiftsActive)}</CardRow>
            <CardRow label="Tanpa laporan lokasi">{formatCount(model.coverage.value.shiftsWithoutLocationReport)}</CardRow>
            <CardRow label="Gerobak idle">{formatCount(model.coverage.value.stallsIdle)}</CardRow>
          </div>
        </SectionCard>

        <SectionCard title="Posisi Kas" section={model.cashPosition}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Diharapkan">
              <MoneyText value={model.cashPosition.value.expectedCash} density="hq" />
            </CardRow>
            <CardRow label="Dihitung">
              <MoneyText value={model.cashPosition.value.countedCash} density="hq" />
            </CardRow>
            <CardRow label="Selisih">
              <MoneyText value={model.cashPosition.value.varianceAmount} density="hq" />
            </CardRow>
            <CardRow label="Verifikasi tertunda">{formatCount(model.cashPosition.value.unresolvedVerificationsCount)}</CardRow>
          </div>
        </SectionCard>

        <SectionCard title="Antrian Verifikasi" section={model.verificationBacklog}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Pending">{formatCount(model.verificationBacklog.value.pendingCount)}</CardRow>
            <CardRow label="Nilai belum verifikasi">
              <MoneyText value={model.verificationBacklog.value.pendingAmountUnverified} density="hq" emphasis="waiting" />
            </CardRow>
            <CardRow label="Umur tertua">
              {model.verificationBacklog.value.oldestAgeHours === null
                ? "—"
                : formatHours(model.verificationBacklog.value.oldestAgeHours)}
            </CardRow>
          </div>
        </SectionCard>

        <SectionCard title="Stok" section={model.stockStatus}>
          {model.stockStatus.value.items.length === 0 ? (
            <CardEmpty>Belum ada item stok tercatat.</CardEmpty>
          ) : (
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <CardRow label="Stok menipis">{formatCount(model.stockStatus.value.lowCount)}</CardRow>
              <CardRow label="Habis">{formatCount(model.stockStatus.value.outCount)}</CardRow>
              {stockItems.map((item) => (
                <div key={item.stockItemId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: item.quantity < 10 ? "#b45309" : "#374151" }}>
                  <span>{item.name}</span>
                  <strong>{formatCount(item.quantity)}</strong>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Review Pengeluaran" section={model.expenseReview}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Pending review">{formatCount(model.expenseReview.value.pending)}</CardRow>
            <CardRow label="Ditandai">{formatCount(model.expenseReview.value.flagged)}</CardRow>
            <a href="/hq/expenses" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat antrian →</a>
          </div>
        </SectionCard>

        <SectionCard title="Insiden" section={model.incidents}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Terbuka">{formatCount(model.incidents.value.open)}</CardRow>
            <CardRow label="Kritis">{formatCount(model.incidents.value.critical)}</CardRow>
            <a href="/hq/incidents" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat board →</a>
          </div>
        </SectionCard>

        <SectionCard title="Kelengkapan Tutup Shift" section={model.closingCompleteness}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Terkirim">{formatCount(model.closingCompleteness.value.submitted)}</CardRow>
            <CardRow label="Belum">{formatCount(model.closingCompleteness.value.missing)}</CardRow>
          </div>
        </SectionCard>

        <SectionCard title="Penggunaan Lokasi" section={model.locationUsage}>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <CardRow label="Lokasi aktif">{formatCount(model.locationUsage.value.activeLocations)}</CardRow>
            <CardRow label="Padat">{formatCount(model.locationUsage.value.crowded)}</CardRow>
          </div>
        </SectionCard>

        <SectionCard title="Eksepsi" section={model.exceptions}>
          {exceptions.length === 0 ? (
            <CardEmpty>Tidak ada eksepsi.</CardEmpty>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6, fontSize: 12, color: "#374151" }}>
              {exceptions.slice(0, 6).map((exception) => (
                <li key={exception.id}>
                  {exceptionTitle(exception.type)}
                  {exceptionDetail(exception) ? ` • ${exceptionDetail(exception)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>

      <section style={{ marginTop: 24, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Aksi Cepat</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/hq/verification" style={{ padding: "8px 12px", background: "#0f766e", color: "#fff", borderRadius: 8, fontSize: 13, textDecoration: "none" }}>Verifikasi Pembayaran</a>
          <a href="/hq/expenses" style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none", color: "#111" }}>Review Pengeluaran</a>
          <a href="/hq/incidents" style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none", color: "#111" }}>Insiden</a>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
          Halaman tujuan di atas masih memuat contoh statis; aksinya belum terhubung ke data tersimpan.
        </p>
      </section>

      <footer style={{ marginTop: 24, paddingBottom: 8, fontSize: 11, color: "#9ca3af" }}>
        Dihitung pada {formatJakartaTime(model.kpis.computedAt)} WIB dari data tersimpan. Drill-down dan ekspor belum tersedia.
      </footer>
    </main>
  );
}
