"use client";

import { useEffect, useState } from "react";
import { FreshnessBadge } from "@/shared/ui/FreshnessBadge";
import { MoneyText } from "@/shared/ui/MoneyText";
import { money } from "@/shared/money/money";

interface CardData {
  computedAt: string;
  freshnessBand: "current" | "recent" | "stale";
  value: any;
}

export default function HQPage() {
  const [coverage, setCoverage] = useState<CardData | null>(null);
  const [sales, setSales] = useState<CardData | null>(null);
  const [cash, setCash] = useState<CardData | null>(null);
  const [verification, setVerification] = useState<CardData | null>(null);

  useEffect(() => {
    // In real app, fetch from API. For demo, mock data
    const now = new Date().toISOString();
    setCoverage({ computedAt: now, freshnessBand: "current", value: { shiftsActive: 5, shiftsWithoutLocationReport: 1, stallsIdle: 2 } });
    setSales({ computedAt: now, freshnessBand: "current", value: { totalSales: { amountMinor: 1250000, currency: "IDR" }, count: 42 } });
    setCash({ computedAt: now, freshnessBand: "recent", value: { expectedCash: { amountMinor: 850000, currency: "IDR" }, countedCash: { amountMinor: 840000, currency: "IDR" }, varianceAmount: { amountMinor: -10000, currency: "IDR" }, unresolvedVerificationsCount: 3 } });
    setVerification({ computedAt: now, freshnessBand: "current", value: { pendingCount: 3, pendingAmountUnverified: { amountMinor: 75000, currency: "IDR" }, oldestAgeHours: 2.5 } });
  }, []);

  const Card = ({ title, children, data }: { title: string; children: React.ReactNode; data: CardData | null }) => (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
        {data && <FreshnessBadge computedAt={new Date(data.computedAt)} band={data.freshnessBand} />}
      </div>
      {children}
    </div>
  );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16, background: "#f9fafb", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>HQ Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Coverage, penjualan, kas, verifikasi — dengan freshness</p>
        </div>
        <a href="/" style={{ fontSize: 14, color: "#0f766e", fontWeight: 600 }}>← Operator</a>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        <Card title="Coverage Hari Ini" data={coverage}>
          {coverage ? (
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Shift aktif</span><strong>{coverage.value.shiftsActive}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tanpa laporan lokasi</span><strong>{coverage.value.shiftsWithoutLocationReport}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gerobak idle</span><strong>{coverage.value.stallsIdle}</strong></div>
            </div>
          ) : "Loading..."}
        </Card>

        <Card title="Penjualan Hari Ini" data={sales}>
          {sales ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>Total</span>
                <MoneyText value={money(sales.value.totalSales.amountMinor, "IDR")} density="hq" />
              </div>
              <div style={{ fontSize: 13 }}>Transaksi: {sales.value.count}</div>
            </div>
          ) : "Loading..."}
        </Card>

        <Card title="Posisi Kas" data={cash}>
          {cash ? (
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Diharapkan</span><MoneyText value={money(cash.value.expectedCash.amountMinor, "IDR")} density="hq" /></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Dihitung</span><MoneyText value={money(cash.value.countedCash.amountMinor, "IDR")} density="hq" /></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Selisih</span><MoneyText value={money(cash.value.varianceAmount.amountMinor, "IDR")} density="hq" /></div>
              <div>Verifikasi tertunda: {cash.value.unresolvedVerificationsCount}</div>
            </div>
          ) : "Loading..."}
        </Card>

        <Card title="Antrian Verifikasi" data={verification}>
          {verification ? (
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Pending</span><strong>{verification.value.pendingCount}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Nilai belum verifikasi</span><MoneyText value={money(verification.value.pendingAmountUnverified.amountMinor, "IDR")} density="hq" emphasis="waiting" /></div>
              <div>Umur tertua: {verification.value.oldestAgeHours.toFixed(1)} jam</div>
            </div>
          ) : "Loading..."}
        </Card>

        <Card title="Antrian Review Pengeluaran" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Pending review: 2</div>
            <div>Flagged: 1 (HIGH_AMOUNT)</div>
            <a href="/hq/expenses" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat antrian →</a>
          </div>
        </Card>

        <Card title="Insiden" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Terbuka: 1</div>
            <div>Kritis: 0</div>
            <a href="/hq/incidents" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat board →</a>
          </div>
        </Card>

        <Card title="Kelengkapan Tutup Shift" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Terkirim: 3</div>
            <div>Belum: 2</div>
          </div>
        </Card>

        <Card title="Penggunaan Lokasi" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Lokasi aktif: 4</div>
            <div>Padat: 1</div>
          </div>
        </Card>

        <Card title="Eksepsi" data={null}>
          <div style={{ fontSize: 12, color: "#991b1b" }}>
            <div>• Expense flagged HIGH_AMOUNT</div>
            <div>• Payment pending &gt;24h</div>
          </div>
        </Card>

        <Card title="Stok" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Stok menipis: 0</div>
            <div>Habis: 0</div>
          </div>
        </Card>
      </div>

      <section style={{ marginTop: 24, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Aksi Cepat</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/hq/verification" style={{ padding: "8px 12px", background: "#0f766e", color: "#fff", borderRadius: 8, fontSize: 13, textDecoration: "none" }}>Verifikasi Pembayaran</a>
          <a href="/hq/expenses" style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none", color: "#111" }}>Review Pengeluaran</a>
          <a href="/hq/incidents" style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, textDecoration: "none", color: "#111" }}>Insiden</a>
        </div>
      </section>
    </main>
  );
}
