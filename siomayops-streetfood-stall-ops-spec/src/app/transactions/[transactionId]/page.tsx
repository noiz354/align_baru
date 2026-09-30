"use client";

import { useEffect, useState } from "react";

type Detail = {
  id: string; status: string; totalMinor: number; currency: string; businessDay: string;
  occurredAt: string; acceptedAt: string; outletName: string; shiftId: string;
  lines: Array<{ menuItemId: string; menuItemName: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; currency: string }>;
  payments: Array<{ method: string; status: string; amountMinor: number; currency: string; createdAt: string }>;
};
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function TransactionDetailPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const [transactionId, setTransactionId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void params.then((value) => { if (!cancelled) setTransactionId(value.transactionId); });
    return () => { cancelled = true; };
  }, [params]);
  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    fetch(`/api/v1/transactions/${encodeURIComponent(transactionId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || "Transaksi tidak dapat dimuat.");
        if (!cancelled) setDetail(payload.data);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Terjadi gangguan."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [transactionId]);

  const stateName: Record<string, string> = { COMPLETED: "Selesai", DRAFT: "Belum dibayar", VOIDED: "Dibatalkan", CORRECTED: "Dikoreksi" };
  return <main style={{ minHeight: "100vh", background: "#f6f8f6", color: "#1f2e2a", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px)" }}><div style={{ maxWidth: 900, margin: "0 auto" }}>
    <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/transactions" style={{ color: "inherit" }}>Transaksi</a><span aria-hidden="true"> / </span>Detail</nav>
    {loading ? <div style={card}>Memuat detail transaksi…</div> : error ? <div role="alert" style={{ ...card, color: "#9f352b" }}>{error}<p><a href="/transactions">Kembali ke transaksi</a></p></div> : detail && <>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start", flexWrap: "wrap", marginBottom: 18 }}><div><p style={{ margin: "0 0 6px", color: "#087960", fontWeight: 700, fontSize: 12 }}>RINCIAN TRANSAKSI</p><h1 style={{ margin: 0, color: "#173c34", fontSize: 32 }}>#{detail.id.slice(0, 8)}</h1></div><span style={{ ...badge, background: detail.status === "COMPLETED" ? "#e2f5ee" : "#fff4da", color: detail.status === "COMPLETED" ? "#087960" : "#946513" }}>{stateName[detail.status] ?? detail.status}</span></header>
      <section style={card}><h2 style={heading}>Informasi</h2><dl style={grid}><Info label="Outlet" value={detail.outletName}/><Info label="Tanggal bisnis" value={detail.businessDay}/><Info label="Dicatat pada" value={`${new Date(detail.acceptedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB`}/><Info label="Shift" value={detail.shiftId}/></dl></section>
      <section style={{ ...card, marginTop: 14 }}><h2 style={heading}>Item</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 450 }}><thead><tr><th style={th}>MENU</th><th style={th}>JUMLAH</th><th style={th}>HARGA SATUAN</th><th style={{ ...th, textAlign: "right" }}>TOTAL</th></tr></thead><tbody>{detail.lines.map((line) => <tr key={line.menuItemId}><td style={td}>{line.menuItemName}</td><td style={td}>{line.quantity}</td><td style={td}>{rupiah(line.unitPriceMinor)}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{rupiah(line.lineTotalMinor)}</td></tr>)}</tbody><tfoot><tr><td colSpan={3} style={{ ...td, fontWeight: 800 }}>Total transaksi</td><td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#173c34" }}>{rupiah(detail.totalMinor)}</td></tr></tfoot></table></div></section>
      <section style={{ ...card, marginTop: 14 }}><h2 style={heading}>Pembayaran</h2>{detail.payments.length ? detail.payments.map((payment) => <div key={`${payment.createdAt}-${payment.method}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #edf1ef", padding: "12px 0", flexWrap: "wrap" }}><span>{payment.method === "CASH" ? "Tunai" : payment.method} · {payment.status === "PAID" ? "Dibayar" : payment.status}</span><strong>{rupiah(payment.amountMinor)}</strong></div>) : <p style={{ color: "#72817c" }}>Belum ada pembayaran tercatat.</p>}</section>
    </>}
  </div></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt style={{ color: "#819089", fontSize: 12 }}>{label}</dt><dd style={{ margin: "5px 0 0", fontWeight: 600, overflowWrap: "anywhere" }}>{value}</dd></div>; }
const card: React.CSSProperties = { background: "white", border: "1px solid #e1e9e5", borderRadius: 16, padding: "20px 22px", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const heading: React.CSSProperties = { fontSize: 17, color: "#173c34", margin: "0 0 16px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 };
const th: React.CSSProperties = { textAlign: "left", fontSize: 10, letterSpacing: ".08em", color: "#819089", padding: "10px 8px", borderBottom: "1px solid #e9efec", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "13px 8px", borderBottom: "1px solid #edf1ef", fontSize: 13 };
const badge: React.CSSProperties = { display: "inline-block", padding: "7px 11px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
