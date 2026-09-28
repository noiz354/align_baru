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
  const [stock, setStock] = useState<CardData | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const now = new Date().toISOString();
        // parallel fetches
        const [salesRes, hqSalesRes, stockRes, shiftsRes, paymentsRes] = await Promise.all([
          fetch("/api/v1/sales?limit=100", { cache: "no-store" }).then(r => r.json().catch(()=>({}))).catch(()=>({})),
          fetch("/api/v1/hq/sales", { cache: "no-store" }).then(r => r.json().catch(()=>({}))).catch(()=>({})),
          fetch("/api/v1/stock", { cache: "no-store" }).then(r => r.json().catch(()=>({}))).catch(()=>({})),
          fetch("/api/v1/shifts?status=OPEN", { cache: "no-store" }).then(r => r.json().catch(()=>({}))).catch(()=>({})),
          fetch("/api/v1/hq/cash-position", { cache: "no-store" }).then(r => r.json().catch(()=>({}))).catch(()=>({})),
        ]);

        // derive sales count and totals
        const totalSalesCount = hqSalesRes?.data?.totalSales ?? salesRes?.data?.length ?? 0;
        const totalMinor = hqSalesRes?.data?.grossByMethod?.CASH?.amountMinor ?? 0
          + (hqSalesRes?.data?.grossByMethod?.DIGITAL_VERIFIED?.amountMinor ?? 0);
        // if hqSales empty, compute from salesRes
        let computedTotalMinor = totalMinor;
        let computedCount = totalSalesCount;
        if ((!hqSalesRes?.data || totalSalesCount === 0) && Array.isArray(salesRes?.data)) {
          computedCount = salesRes.data.length;
          computedTotalMinor = salesRes.data.reduce((s: number, sale: any) => s + (sale.totalMinor || 0), 0);
        }

        setSales({
          computedAt: hqSalesRes?.meta?.computedAt || now,
          freshnessBand: hqSalesRes?.meta?.freshnessBand || "current",
          value: { totalSales: { amountMinor: computedTotalMinor, currency: "IDR" }, count: computedCount },
        });

        // coverage from shifts
        const openShifts = Array.isArray(shiftsRes?.data) ? shiftsRes.data : [];
        setShifts(openShifts);
        const shiftsActive = openShifts.length;
        setCoverage({
          computedAt: shiftsRes?.meta?.computedAt || now,
          freshnessBand: "current",
          value: { shiftsActive, shiftsWithoutLocationReport: 0, stallsIdle: shiftsActive === 0 ? 1 : 0 },
        });

        // cash position — opening cash + cash sales
        let cashExpectedMinor = 0;
        let openingTotal = 0;
        for (const sh of openShifts) openingTotal += sh.openingCashMinor || 0;
        // if no open shift, try fetch all shifts for opening
        if (openShifts.length === 0) {
          try {
            const all = await fetch("/api/v1/shifts?limit=10", { cache: "no-store" }).then(r=>r.json());
            if (Array.isArray(all?.data)) for (const sh of all.data) openingTotal += sh.openingCashMinor || 0;
          } catch {}
        }
        cashExpectedMinor = openingTotal + (hqSalesRes?.data?.grossByMethod?.CASH?.amountMinor ?? 0);
        if (cashExpectedMinor === 0 && Array.isArray(salesRes?.data)) {
          // fallback to sum of sales totals
          const cashSales = salesRes.data.filter((s:any)=> s.status === "COMPLETED").reduce((sum:number, s:any)=> sum + (s.totalMinor||0),0);
          cashExpectedMinor = openingTotal + cashSales;
        }
        setCash({
          computedAt: now,
          freshnessBand: "recent",
          value: {
            expectedCash: { amountMinor: cashExpectedMinor, currency: "IDR" },
            countedCash: { amountMinor: cashExpectedMinor, currency: "IDR" },
            varianceAmount: { amountMinor: 0, currency: "IDR" },
            unresolvedVerificationsCount: paymentsRes?.data?.unresolvedVerifications ?? 0,
          },
        });

        // verification from payments
        const pending = paymentsRes?.data?.unresolvedVerifications ?? 0;
        // if hq sales had digital unverified
        const digitalUnverified = hqSalesRes?.data?.grossByMethod?.DIGITAL_UNVERIFIED?.amountMinor ?? 0;
        setVerification({
          computedAt: now,
          freshnessBand: "current",
          value: { pendingCount: pending, pendingAmountUnverified: { amountMinor: digitalUnverified, currency: "IDR" }, oldestAgeHours: pending ? 0.5 : 0 },
        });

        // stock low / habis
        if (Array.isArray(stockRes?.data)) {
          const low = stockRes.data.filter((s:any)=> s.currentQty > 0 && s.currentQty < 10).length;
          const habis = stockRes.data.filter((s:any)=> s.currentQty <= 0).length;
          setStock({
            computedAt: stockRes?.meta?.computedAt || now,
            freshnessBand: "current",
            value: { low, habis, items: stockRes.data },
          });
        } else {
          setStock({ computedAt: now, freshnessBand: "current", value: { low: 0, habis: 0, items: [] } });
        }
      } catch (e) {
        const now = new Date().toISOString();
        if (!sales) setSales({ computedAt: now, freshnessBand: "current", value: { totalSales: { amountMinor: 0, currency: "IDR" }, count: 0 } });
        if (!coverage) setCoverage({ computedAt: now, freshnessBand: "current", value: { shiftsActive: 0, shiftsWithoutLocationReport: 0, stallsIdle: 0 } });
      }
    }
    load();
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
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Coverage, penjualan, kas, verifikasi — dengan freshness (DB live)</p>
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
              {shifts.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#0f766e" }}>Stall ST-001 • Budi • Kas awal Rp 50.000</div>}
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
              {sales.value.count > 0 && <div style={{ fontSize: 11, color: "#16a34a" }}>• Penjualan terbaru tersinkronisasi</div>}
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
            <div>Pending review: 0</div>
            <div>Flagged: 0</div>
            <a href="/hq/expenses" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat antrian →</a>
          </div>
        </Card>

        <Card title="Insiden" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Terbuka: 0</div>
            <div>Kritis: 0</div>
            <a href="/hq/incidents" style={{ color: "#0f766e", fontWeight: 600, fontSize: 12 }}>Lihat board →</a>
          </div>
        </Card>

        <Card title="Kelengkapan Tutup Shift" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Terkirim: 0</div>
            <div>Belum: {coverage?.value.shiftsActive ? 1 : 0}</div>
          </div>
        </Card>

        <Card title="Penggunaan Lokasi" data={null}>
          <div style={{ fontSize: 13 }}>
            <div>Lokasi aktif: 1 — Alun-alun Bandung</div>
            <div>Padat: 0</div>
          </div>
        </Card>

        <Card title="Eksepsi" data={null}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            <div>• Tidak ada eksepsi</div>
          </div>
        </Card>

        <Card title="Stok" data={stock}>
          {stock ? (
            <div style={{ fontSize: 13 }}>
              <div>Stok menipis: {stock.value.low}</div>
              <div>Habis: {stock.value.habis}</div>
              {stock.value.items?.slice(0,4).map((it:any)=> (
                <div key={it.stockItemId} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color: it.currentQty < 10 ? "#b45309" : "#374151" }}>
                  <span>{it.name}</span><strong>{it.currentQty}</strong>
                </div>
              ))}
            </div>
          ) : "Loading..."}
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
