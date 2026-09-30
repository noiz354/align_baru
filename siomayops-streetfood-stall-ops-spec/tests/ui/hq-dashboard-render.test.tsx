/**
 * HQ dashboard rendering tests (Step 22 of the dashboard integration brief).
 *
 * These tests render the shipped `DashboardView` from a read model produced by the shipped read
 * model over the shipped in-memory store — the same path the Server Component takes. Assertions are
 * on rendered text, not on snapshots, so a design tweak does not turn the suite red but a lost or
 * fabricated figure does.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getHqDashboardReadModel } from "@/features/hq/dashboard-read-model";
import { DashboardView } from "@/app/hq/_ui/dashboard-view";
import {
  BUSINESS_DAY,
  EMPTY_BUSINESS_DAY,
  FIXTURE_NOW,
  ORG_ID,
  STALL_B,
  seedDashboardFixture,
  seedEmptyBusinessDay,
} from "./_fixtures/hq-dashboard-fixture";

// `DashboardFilters` is a client component that reads the Next router. It is not the subject of
// these tests (its URL behaviour is covered by the boundary tests and the browser run), so the
// router is stubbed rather than mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/hq",
  useSearchParams: () => new URLSearchParams(),
}));

/** HTML → visible text: strips tags, normalises the non-breaking space Intl uses between Rp and the amount. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderDashboard(options: { outletId?: string; businessDay?: string } = {}): string {
  const model = getHqDashboardReadModel({
    organizationId: ORG_ID,
    outletId: options.outletId,
    businessDay: options.businessDay ?? BUSINESS_DAY,
    now: FIXTURE_NOW,
  });
  return visibleText(renderToStaticMarkup(<DashboardView model={model} />));
}

describe("HQ dashboard renders the read model (T-HQ-003 integration)", () => {
  beforeEach(() => {
    seedDashboardFixture();
  });

  it("renders the KPI figures from persisted data, each money value formatted once", () => {
    const text = renderDashboard();
    expect(text).toContain("Penjualan Hari Ini Rp 35.000");
    expect(text).toContain("Transaksi 1");
    expect(text).toContain("Rata-rata Transaksi Rp 35.000");
    expect(text).toContain("Pengeluaran Rp 25.000");
    expect(text).toContain("Rasio Pengeluaran 71%");
    expect(text).toContain("Outlet Aktif 1 dari 2 outlet aktif");
    expect(text).toContain("Total Outlet 2");
  });

  it("keeps verified and unverified digital money as separate lines and out of the headline figure", () => {
    const text = renderDashboard();
    expect(text).toContain("Digital terverifikasi Rp 0");
    expect(text).toContain("Digital belum verifikasi Rp 18.000");
    expect(text).toContain("bukan pendapatan terverifikasi");
    // The headline figure is completed sales only (Rp 35.000), never 35.000 + 18.000.
    expect(text).not.toContain("Rp 53.000");
  });

  it("renders outlet rows with code, operator, start time, money columns and status", () => {
    const text = renderDashboard();
    expect(text).toContain("ST-001 Budi 13:10 Rp 35.000 Rp 25.000 Buka");
    expect(text).toContain("ST-002 — — Rp 0 Rp 0 Belum mulai");
  });

  it("maps structured alert types to Indonesian copy without putting wording in the read model", () => {
    const text = renderDashboard();
    expect(text).toContain("Belum memulai operasional");
    expect(text).toContain("Pembayaran digital belum diverifikasi");
    expect(text).toContain("Perlu perhatian");

    const model = getHqDashboardReadModel({ organizationId: ORG_ID, businessDay: BUSINESS_DAY, now: FIXTURE_NOW });
    const alertTypes = model.alerts.value.map((alert) => alert.type);
    expect(alertTypes).toContain("OUTLET_NOT_STARTED");
    expect(alertTypes).toContain("UNVERIFIED_DIGITAL_PAYMENT");
    // The read model carries no rendered strings.
    for (const alert of model.alerts.value) {
      expect(Object.keys(alert)).not.toContain("message");
    }
  });

  it("maps structured activity events to Indonesian copy and survives an unknown event type", () => {
    const text = renderDashboard();
    expect(text).toContain("mencatat penjualan • Penjualan ST-001");
    expect(text).toContain("mencatat pengeluaran • Pengeluaran ST-001");
    expect(text).toContain("mencatat aktivitas operasional • Catatan");
  });

  it("scopes the feed to the business day instead of every event ever recorded", () => {
    const model = getHqDashboardReadModel({ organizationId: ORG_ID, businessDay: BUSINESS_DAY, now: FIXTURE_NOW });
    expect(model.recentActivity.value.map((entry) => entry.id)).not.toContain("audit-old");
  });

  it("renders the chart from the read model trend (full day buckets, real totals)", () => {
    const text = renderDashboard();
    expect(text).toContain("Tren Penjualan per Jam");
    expect(text).toContain("Total grafik Rp 35.000");
    expect(text).toContain("Jam tersibuk 13:00 (1 transaksi)");

    const model = getHqDashboardReadModel({ organizationId: ORG_ID, businessDay: BUSINESS_DAY, now: FIXTURE_NOW });
    const points = model.salesTrend.value.points;
    expect(points).toHaveLength(24);
    expect(points.map((point) => point.hourLocal)).toEqual([...Array(24).keys()].map((hour) => (hour + 4) % 24));
    expect(points.reduce((sum, point) => sum + point.total.amountMinor, 0)).toBe(35000);
  });

  it("renders the empty state for a day with no activity, with no sample data and no NaN", () => {
    seedEmptyBusinessDay();
    const text = renderDashboard();
    expect(text).toContain("Penjualan Hari Ini Rp 0");
    expect(text).toContain("Transaksi 0");
    expect(text).toContain("Rata-rata Transaksi — Belum ada transaksi");
    expect(text).toContain("Rasio Pengeluaran — Butuh penjualan untuk dihitung");
    expect(text).toContain("Belum memulai operasional");
    expect(text).toContain("Belum ada transaksi pada tanggal ini");
    expect(text).toContain("Belum ada aktivitas operasional pada tanggal ini");
    expect(text).toContain("Tidak ada eksepsi.");
    expect(text).not.toMatch(/NaN|Infinity|undefined|8\.450\.000|1\.275\.000/);
  });

  it("keeps outlet rows valid but empty-handed on a day with no shifts", () => {
    seedEmptyBusinessDay();
    const text = renderDashboard();
    expect(text).toContain("ST-001 — — Rp 0 Rp 0 Belum mulai");
    expect(text).toContain("Penjualan Hari Ini Rp 0");
  });

  it("renders only the authorized outlet when the server narrowed the scope", () => {
    const text = renderDashboard({ outletId: STALL_B });
    expect(text).toContain("ST-002 — — Rp 0 Rp 0 Belum mulai");
    expect(text).not.toContain("ST-001");
    expect(text).toContain("Penjualan Hari Ini Rp 0");
  });

  it("reports the unfiltered day when the selected date has no rows at all", () => {
    const text = renderDashboard({ businessDay: EMPTY_BUSINESS_DAY });
    expect(text).toContain("Data tersimpan untuk 1 September 2026");
    expect(text).toContain("Belum ada aktivitas operasional pada tanggal ini");
  });
});
