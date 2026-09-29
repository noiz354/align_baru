"use client";

import { useCallback, useEffect, useState } from "react";

type Transaction = { id: string; occurredAt: string; totalMinor: number; status: string; paymentStatus: string | null };
type Expense = { id: string; occurredAt: string; amountMinor: number; category: string; description: string; reviewStatus: string };
type Detail = {
  generatedAt: string;
  sourceWatermark: string | null;
  businessDay: string;
  outlet: { id: string; name: string; operatorName: string | null; startedAt: string | null; salesMinor: number; transactionCount: number; expensesMinor: number; status: string; statusReason: string | null };
  transactions: Transaction[];
  expenses: Expense[];
  nextCursor: string | null;
};
const money = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;
const datetime = (value: string) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function OutletDetailPage({ params }: { params: Promise<{ outletId: string }> }) {
  const [outletId, setOutletId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => { void params.then((value) => setOutletId(value.outletId)); }, [params]);
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("date");
    if (current) setDate(current);
  }, []);

  const load = useCallback(async (cursor?: string) => {
    if (!outletId) return;
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/v1/hq/outlets/${encodeURIComponent(outletId)}?${query.toString()}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || "Tidak dapat memuat detail outlet.");
    return body.data as Detail;
  }, [date, outletId]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await load(); if (result) setDetail(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan."); }
    finally { setLoading(false); }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMore = async () => {
    if (!detail?.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await load(detail.nextCursor);
      if (page) setDetail((current) => current ? { ...page, transactions: [...current.transactions, ...page.transactions], expenses: [...current.expenses, ...page.expenses] } : page);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Gagal memuat halaman berikutnya."); }
    finally { setLoadingMore(false); }
  };

  return <main className="outlet-detail-page">
    <header className="detail-topbar"><a href="/hq" className="detail-back">← Dashboard</a><span>SiomayOps <i>·</i> Operasional</span><a href="/" className="detail-home">Beranda operator</a></header>
    <section className="detail-content">
      <div className="detail-breadcrumb">DASHBOARD <span>/</span> STATUS OUTLET <span>/</span> DETAIL</div>
      <div className="detail-title-row"><div><h1>{loading ? "Memuat outlet…" : detail?.outlet.name ?? "Detail Outlet"}</h1><p>Ringkasan operasional dari catatan tersimpan untuk hari bisnis terpilih.</p></div><label className="detail-date">Tanggal bisnis<input type="date" value={date || detail?.businessDay || ""} onChange={(event) => setDate(event.target.value)}/></label></div>
      {loading && <div className="detail-loading" aria-live="polite"><i/><i/><i/><span>Memuat data outlet…</span></div>}
      {!loading && error && <div className="detail-error" role="alert"><strong>Data outlet tidak dapat dimuat</strong><span>{error}</span><button onClick={() => void refresh()}>Coba lagi</button></div>}
      {!loading && !error && detail && <>
        <div className="detail-metrics"><article><span>Status</span><strong>{detail.outlet.status === "OPERATING" ? "Beroperasi" : detail.outlet.status === "NOT_STARTED" ? "Belum Mulai" : detail.outlet.status}</strong><small>{detail.outlet.operatorName ? `Operator ${detail.outlet.operatorName}` : "Belum ada operator pada hari ini"}</small></article><article><span>Penjualan</span><strong>{money(detail.outlet.salesMinor)}</strong><small>{detail.outlet.transactionCount} transaksi selesai</small></article><article><span>Pengeluaran</span><strong>{money(detail.outlet.expensesMinor)}</strong><small>Total catatan pada hari bisnis ini</small></article><article><span>Mulai operasi</span><strong>{detail.outlet.startedAt ? datetime(detail.outlet.startedAt) : "—"}</strong><small>{detail.outlet.statusReason ?? "Waktu berasal dari shift tersimpan"}</small></article></div>
        <div className="detail-record-grid"><section className="detail-panel"><div className="detail-panel-heading"><div><h2>Transaksi tersimpan</h2><p>Transaksi selesai pada hari bisnis terpilih</p></div><span>{detail.transactions.length}</span></div>{detail.transactions.length ? <div className="detail-record-list">{detail.transactions.map((row) => <div className="detail-record" key={row.id}><div><strong>{money(row.totalMinor)}</strong><small>{datetime(row.occurredAt)} WIB · {row.paymentStatus ?? "Status pembayaran tidak tersedia"}</small></div><span>{row.status}</span></div>)}</div> : <div className="detail-empty">Belum ada transaksi selesai untuk outlet ini.</div>}</section>
          <section className="detail-panel"><div className="detail-panel-heading"><div><h2>Pengeluaran tersimpan</h2><p>Catatan biaya dan status tinjau</p></div><span>{detail.expenses.length}</span></div>{detail.expenses.length ? <div className="detail-record-list">{detail.expenses.map((row) => <div className="detail-record" key={row.id}><div><strong>{money(row.amountMinor)} <small>· {row.category}</small></strong><small>{datetime(row.occurredAt)} WIB · {row.description}</small></div><span>{row.reviewStatus}</span></div>)}</div> : <div className="detail-empty">Belum ada pengeluaran tercatat untuk outlet ini.</div>}</section></div>
        <footer className="detail-freshness">Dihitung {datetime(detail.generatedAt)} WIB <span>·</span> Sumber terakhir {detail.sourceWatermark ? datetime(detail.sourceWatermark) + " WIB" : "belum ada catatan sumber"}</footer>
        {detail.nextCursor && <button className="detail-load-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Memuat…" : "Muat aktivitas berikutnya"}</button>}
      </>}
    </section>
  </main>;
}
