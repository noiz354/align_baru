"use client";

import { useEffect, useState } from "react";

type ReportPoint = {
  businessDay: string; salesMinor: number; completedTransactions: number; cashPaidMinor: number;
  digitalVerifiedMinor: number; digitalUnverifiedMinor: number; reportedExpensesMinor: number;
  salesAfterExpensesMinor: number; incidentCount: number;
};
type ReportOutlet = {
  id: string; name: string; areaId: string; salesMinor: number; completedTransactions: number;
  averageTransactionMinor: number; cashPaidMinor: number; digitalVerifiedMinor: number;
  digitalUnverifiedMinor: number; reportedExpensesMinor: number; salesAfterExpensesMinor: number; incidentCount: number;
};
type Report = {
  generatedAt: string; sourceWatermark: string | null; freshnessBand: "current" | "recent" | "stale" | "unknown";
  filters: { dateFrom: string; dateTo: string; areaId: string | null; outletId: string | null };
  summary: {
    salesMinor: number; completedTransactions: number; averageTransactionMinor: number; cashPaidMinor: number;
    digitalVerifiedMinor: number; digitalUnverifiedMinor: number; reportedExpensesMinor: number;
    salesAfterExpensesMinor: number; incidentCount: number; unattributedIncidentCount: number; outletCount: number;
  };
  incidents: { total: number; unattributedCount: number; byStatus: Record<string, number>; byCategory: Record<string, number>; locationBasis: "SHIFT_START_LOCATION" };
  series: ReportPoint[]; outlets: ReportOutlet[]; pagination: { limit: number; total: number; nextCursor: string | null };
  options: { areas: Array<{ id: string; label: string }>; outlets: Array<{ id: string; name: string; areaId: string }> };
};

const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const dayLabel = (day: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${day}T12:00:00+07:00`));
const dateTimeLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [areaId, setAreaId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => { void loadReport(); }, []);

  async function loadReport(filters?: { dateFrom?: string; dateTo?: string; areaId?: string; outletId?: string; cursor?: string }) {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ limit: "25" });
    if (filters?.dateFrom && filters?.dateTo) {
      query.set("dateFrom", filters.dateFrom);
      query.set("dateTo", filters.dateTo);
    }
    if (filters?.areaId) query.set("areaId", filters.areaId);
    if (filters?.outletId) query.set("outletId", filters.outletId);
    if (filters?.cursor) query.set("cursor", filters.cursor);
    try {
      const response = await fetch(`/api/v1/reports?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Laporan tidak dapat dimuat.");
      const data = payload.data as Report;
      setReport(data);
      setDateFrom(data.filters.dateFrom);
      setDateTo(data.filters.dateTo);
      setAreaId(data.filters.areaId ?? "");
      setOutletId(data.filters.outletId ?? "");
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Terjadi gangguan saat memuat laporan.");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExportMessage("");
    if (!dateFrom || !dateTo) return setError("Pilih tanggal awal dan akhir laporan.");
    if (dateFrom > dateTo) return setError("Tanggal awal harus sama dengan atau sebelum tanggal akhir.");
    const [fy, fm, fd] = dateFrom.split("-").map(Number);
    const [ty, tm, td] = dateTo.split("-").map(Number);
    const days = Math.floor((Date.UTC(ty!, tm! - 1, td!, 12) - Date.UTC(fy!, fm! - 1, fd!, 12)) / 86_400_000) + 1;
    if (days > 31) return setError("Rentang laporan maksimal 31 hari bisnis.");
    void loadReport({ dateFrom, dateTo, areaId, outletId });
  }

  function refreshCurrentReport() {
    if (dateFrom && dateTo) void loadReport({ dateFrom, dateTo, areaId, outletId });
    else void loadReport();
  }

  async function exportReport() {
    if (!report) return;
    setExporting(true);
    setExportMessage("");
    try {
      const query = new URLSearchParams({ dateFrom: report.filters.dateFrom, dateTo: report.filters.dateTo });
      if (report.filters.areaId) query.set("areaId", report.filters.areaId);
      if (report.filters.outletId) query.set("outletId", report.filters.outletId);
      const response = await fetch(`/api/v1/reports/export?${query}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message || "CSV tidak dapat dibuat.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `siomayops-report-${report.filters.dateFrom}-${report.filters.dateTo}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setExportMessage("CSV laporan berhasil dibuat dan audit ekspor dicatat.");
    } catch (cause) {
      setExportMessage(cause instanceof Error ? cause.message : "CSV tidak dapat dibuat.");
    } finally {
      setExporting(false);
    }
  }

  const maxSales = Math.max(1, ...(report?.series.map((point) => point.salesMinor) ?? [0]));
  const selectedOutletName = report?.options.outlets.find((outlet) => outlet.id === outletId)?.name;

  return <main style={{ minHeight: "100vh", background: "#f5f8f6", color: "#203c33", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
    <div style={{ maxWidth: 1220, margin: "0 auto" }}>
      <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/" style={{ color: "inherit" }}>Beranda</a><span aria-hidden="true"> / </span><strong style={{ color: "#173c34" }}>Laporan &amp; Ekspor</strong></nav>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, margin: "0 0 6px" }}>DATA OPERASIONAL TERSIMPAN</p><h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: 0, color: "#173c34" }}>Laporan &amp; Ekspor</h1><p style={{ color: "#687a74", margin: "8px 0 0" }}>Ringkasan penjualan selesai, biaya yang dilaporkan, performa outlet, dan insiden terkait. Hari bisnis mengikuti batas 04.00 Asia/Jakarta.</p></div>
        <button onClick={refreshCurrentReport} style={secondaryButton} disabled={loading}>Muat ulang</button>
      </header>

      <form onSubmit={applyFilters} aria-label="Filter laporan" style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={labelStyle}>Dari tanggal bisnis<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} required style={inputStyle}/></label>
        <label style={labelStyle}>Sampai tanggal bisnis<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} required style={inputStyle}/></label>
        <label style={labelStyle}>Area<select value={areaId} onChange={(event) => { setAreaId(event.target.value); setOutletId(""); }} style={inputStyle}><option value="">Semua area yang dapat diakses</option>{report?.options.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>
        <label style={labelStyle}>Outlet<select value={outletId} onChange={(event) => setOutletId(event.target.value)} style={inputStyle}><option value="">Semua outlet yang dapat diakses</option>{report?.options.outlets.filter((outlet) => !areaId || outlet.areaId === areaId).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
        <button type="submit" style={primaryButton} disabled={loading}>Terapkan filter</button>
      </form>

      {error && <div role="alert" style={noticeStyle("error")}>{error}<button onClick={refreshCurrentReport} style={{ ...secondaryButton, marginLeft: 12 }}>Muat ulang laporan</button></div>}
      {exportMessage && <div role={exportMessage.includes("berhasil") ? "status" : "alert"} style={noticeStyle(exportMessage.includes("berhasil") ? "success" : "error")}>{exportMessage}</div>}
      {loading && <section style={panel} aria-live="polite"><div style={emptyStyle}>Menghitung laporan dari catatan tersimpan…</div></section>}
      {!loading && report && <>
        <section aria-label="Ringkasan laporan" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
          <Metric label="Penjualan selesai" value={money(report.summary.salesMinor)} note={`${report.summary.completedTransactions} transaksi selesai`}/>
          <Metric label="Pengeluaran dilaporkan" value={money(report.summary.reportedExpensesMinor)} note="Semua status laporan biaya"/>
          <Metric label="Sales setelah pengeluaran" value={money(report.summary.salesAfterExpensesMinor)} note="Bukan laba atau angka akuntansi"/>
          <Metric label="Insiden tercatat" value={String(report.incidents.total)} note={`${report.incidents.unattributedCount} tanpa shift/outlet tertaut`}/>
        </section>

        <section style={{ ...panel, marginBottom: 14 }} aria-labelledby="sales-breakdown-title">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 14 }}><div><h2 id="sales-breakdown-title" style={{ margin: 0, fontSize: 18 }}>Rincian pembayaran dan sumber</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>Periode {dayLabel(report.filters.dateFrom)}–{dayLabel(report.filters.dateTo)}{selectedOutletName ? ` · ${selectedOutletName}` : ""}</p></div><button onClick={() => void exportReport()} disabled={exporting} style={primaryButton}>{exporting ? "Menyiapkan CSV…" : "Unduh CSV"}</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Breakdown label="Tunai dibayar" value={report.summary.cashPaidMinor}/>
            <Breakdown label="Digital terverifikasi" value={report.summary.digitalVerifiedMinor}/>
            <Breakdown label="Digital belum terverifikasi" value={report.summary.digitalUnverifiedMinor}/>
            <Breakdown label="Rata-rata transaksi selesai" value={report.summary.averageTransactionMinor}/>
          </div>
          <p style={{ color: "#718078", fontSize: 12, lineHeight: 1.5, margin: "12px 0 0" }}>Nilai digital yang belum terverifikasi tetap dipisahkan dari pembayaran terverifikasi. Pengeluaran mencakup laporan dari operator dan bukan keputusan pengakuan akuntansi.</p>
        </section>

        <section style={{ ...panel, marginBottom: 14 }} aria-labelledby="series-title">
          <div style={{ marginBottom: 12 }}><h2 id="series-title" style={{ margin: 0, fontSize: 18 }}>Tren harian</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>Setiap batang menunjukkan penjualan selesai; daftar di bawah menyertakan biaya dan insiden.</p></div>
          {report.series.every((point) => point.salesMinor === 0) ? <div style={emptyStyle}>Belum ada penjualan selesai pada rentang ini.</div> : <div aria-label="Grafik batang penjualan harian" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(report.series.length, 7)}, minmax(0, 1fr))`, gap: 10, alignItems: "end", minHeight: 160, padding: "12px 4px 4px", overflowX: "auto" }}>
            {report.series.map((point) => <div key={point.businessDay} title={`${dayLabel(point.businessDay)} · ${money(point.salesMinor)}`} style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 7, minWidth: 54, height: 140, textAlign: "center" }}><div style={{ display: "flex", alignItems: "end", justifyContent: "center", height: "100%", borderBottom: "1px solid #dfe9e4" }}><div aria-label={`${dayLabel(point.businessDay)} ${money(point.salesMinor)}`} style={{ width: "min(70%, 44px)", height: `${Math.max(point.salesMinor > 0 ? 5 : 1, Math.round(point.salesMinor / maxSales * 100))}%`, background: "#16815c", borderRadius: "6px 6px 0 0" }}/></div><small style={{ color: "#72817c", fontSize: 10 }}>{point.businessDay.slice(5)}</small></div>)}
          </div>}
          <div style={{ overflowX: "auto", marginTop: 10 }}><table style={tableStyle}><thead><tr>{["HARI BISNIS", "PENJUALAN", "TRANSAKSI", "PENGELUARAN", "SETELAH PENGELUARAN", "INSIDEN"].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr></thead><tbody>{report.series.map((point) => <tr key={point.businessDay}><td style={tdStyle}>{dayLabel(point.businessDay)}</td><td style={tdStyle}>{money(point.salesMinor)}</td><td style={tdStyle}>{point.completedTransactions}</td><td style={tdStyle}>{money(point.reportedExpensesMinor)}</td><td style={tdStyle}>{money(point.salesAfterExpensesMinor)}</td><td style={tdStyle}>{point.incidentCount}</td></tr>)}</tbody></table></div>
        </section>

        <section style={panel} aria-labelledby="outlet-report-title">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}><div><h2 id="outlet-report-title" style={{ margin: 0, fontSize: 18 }}>Performa outlet</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>{report.outlets.length} dari {report.pagination.total} outlet · sales dikurangi pengeluaran terlapor, bukan laba</p></div><div style={{ display: "flex", gap: 10, alignItems: "center", color: "#72817c", fontSize: 12, textAlign: "right" }}><span>Dihitung {dateTimeLabel(report.generatedAt)}<br/>Sumber terakhir {report.sourceWatermark ? dateTimeLabel(report.sourceWatermark) : "belum ada"} · {report.freshnessBand}</span></div></div>
          {report.outlets.length === 0 ? <div style={emptyStyle}>Tidak ada outlet dalam cakupan laporan ini.</div> : <div style={{ overflowX: "auto" }}><table style={{ ...tableStyle, minWidth: 760 }}><thead><tr>{["OUTLET", "PENJUALAN", "TRANSAKSI", "RATA-RATA", "PENGELUARAN", "SETELAH PENGELUARAN", "INSIDEN"].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr></thead><tbody>{report.outlets.map((outlet) => <tr key={outlet.id}><td style={tdStyle}><strong>{outlet.name}</strong><small style={{ display: "block", color: "#819089", marginTop: 4 }}>Area {outlet.areaId}</small></td><td style={tdStyle}>{money(outlet.salesMinor)}</td><td style={tdStyle}>{outlet.completedTransactions}</td><td style={tdStyle}>{money(outlet.averageTransactionMinor)}</td><td style={tdStyle}>{money(outlet.reportedExpensesMinor)}</td><td style={tdStyle}>{money(outlet.salesAfterExpensesMinor)}</td><td style={tdStyle}>{outlet.incidentCount}</td></tr>)}</tbody></table></div>}
          {report.pagination.nextCursor && <button onClick={() => void loadReport({ dateFrom, dateTo, areaId, outletId, cursor: report.pagination.nextCursor ?? undefined })} disabled={loading} style={{ ...secondaryButton, marginTop: 14 }}>Muat outlet berikutnya</button>}
        </section>
        <p style={{ color: "#778781", fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>Insiden yang tertaut ke shift dikelompokkan menggunakan lokasi awal shift karena lokasi tepat saat insiden tidak tersimpan. Insiden tanpa shift hanya masuk total saat laporan tidak difilter ke area/outlet.</p>
      </>}
    </div>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article style={{ ...panel, minWidth: 0 }}><span style={{ color: "#718078", fontSize: 12, fontWeight: 700 }}>{label}</span><strong style={{ display: "block", fontSize: 22, color: "#173c34", margin: "8px 0 5px", overflowWrap: "anywhere" }}>{value}</strong><small style={{ color: "#819089" }}>{note}</small></article>;
}
function Breakdown({ label, value }: { label: string; value: number }) {
  return <div style={{ background: "#f7faf8", border: "1px solid #e9efec", borderRadius: 10, padding: 13 }}><span style={{ color: "#72817c", fontSize: 12 }}>{label}</span><strong style={{ display: "block", marginTop: 6, fontSize: 16 }}>{money(value)}</strong></div>;
}

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1e9e5", borderRadius: 16, padding: "18px 20px", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const primaryButton: React.CSSProperties = { border: 0, background: "#087960", color: "white", fontWeight: 700, borderRadius: 10, padding: "11px 16px", minHeight: 44, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid #dbe5e0", background: "#fff", color: "#31534a", fontWeight: 600, borderRadius: 9, padding: "10px 13px", minHeight: 42, cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#4f655d", fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { minHeight: 42, minWidth: 150, border: "1px solid #dbe5e0", borderRadius: 9, padding: "8px 10px", color: "#203c33", background: "white", font: "inherit" };
const emptyStyle: React.CSSProperties = { padding: "30px 16px", textAlign: "center", color: "#778781", background: "#fafcfb", borderRadius: 12 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 650 };
const thStyle: React.CSSProperties = { textAlign: "left", fontSize: 10, letterSpacing: ".07em", color: "#819089", padding: "11px 9px", borderBottom: "1px solid #e9efec", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 9px", borderBottom: "1px solid #edf1ef", fontSize: 13, verticalAlign: "middle", whiteSpace: "nowrap" };
function noticeStyle(tone: "success" | "error"): React.CSSProperties { return { background: tone === "success" ? "#e8f7ef" : "#fff0ef", color: tone === "success" ? "#176b4f" : "#9f352b", border: `1px solid ${tone === "success" ? "#bfe6d1" : "#f0c8c4"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }; }
