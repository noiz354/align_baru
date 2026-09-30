"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string; status: string; totalMinor: number; currency: "IDR"; businessDay: string;
  occurredAt: string; acceptedAt: string; shiftId: string; stallId: string; outletName: string;
  operatorId: string; lineCount: number; paymentMethod: string | null; paymentStatus: string | null;
};
type Outlet = { id: string; name: string };
type MenuItem = { id: string; name: string; active: boolean; sortOrder: number };
type Shift = { id: string; stallId: string; startLocationId: string; status: string; businessDay: string };
type Product = MenuItem & { priceMinor: number; quantity: number };

const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const statusLabel: Record<string, string> = { DRAFT: "Belum dibayar", COMPLETED: "Selesai", VOIDED: "Dibatalkan", CORRECTED: "Dikoreksi" };

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [businessDay, setBusinessDay] = useState("");
  const [stallId, setStallId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [cashReceivedMinor, setCashReceivedMinor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (businessDay) params.set("businessDay", businessDay);
      if (stallId) params.set("stallId", stallId);
      if (status) params.set("status", status);
      const response = await fetch(`/api/v1/transactions?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Transaksi gagal dimuat.");
      setRows(payload.data ?? []);
      setOutlets(payload.outlets ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi gangguan saat memuat transaksi.");
    } finally {
      setLoading(false);
    }
  }, [businessDay, stallId, status]);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  const totalMinor = useMemo(() => products.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0), [products]);
  const activeShift = shifts.find((shift) => shift.id === selectedShiftId);

  async function loadProductsForLocation(locationId: string) {
    const params = new URLSearchParams({ sellingLocationId: locationId, limit: "100" });
    const [menuResponse, priceResponse] = await Promise.all([
      fetch(`/api/v1/menu/items?${params}`, { cache: "no-store" }),
      fetch(`/api/v1/menu/prices?sellingLocationId=${encodeURIComponent(locationId)}`, { cache: "no-store" }),
    ]);
    const [menuPayload, pricePayload] = await Promise.all([menuResponse.json(), priceResponse.json()]);
    if (!menuResponse.ok || !priceResponse.ok) throw new Error("Menu atau harga outlet tidak dapat dimuat.");
    const priceByMenu = new Map<string, number>((pricePayload.data ?? []).map((price: { menuItemId: string; unitPriceMinor: number }) => [price.menuItemId, price.unitPriceMinor]));
    const available = (menuPayload.data ?? []).filter((item: MenuItem) => item.active && priceByMenu.has(item.id))
      .sort((a: MenuItem, b: MenuItem) => a.sortOrder - b.sortOrder)
      .map((item: MenuItem) => ({ ...item, priceMinor: priceByMenu.get(item.id)!, quantity: 0 }));
    setProducts(available);
    setCreateError(available.length === 0 ? "Belum ada menu aktif dengan harga yang berlaku di outlet ini." : "");
  }

  async function openCreateForm() {
    setCreateError("");
    setSuccess("");
    setCreating(true);
    try {
      const shiftResponse = await fetch("/api/v1/shifts?status=OPEN&limit=100", { cache: "no-store" });
      const shiftPayload = await shiftResponse.json();
      if (!shiftResponse.ok) throw new Error("Data shift tidak dapat dimuat.");
      const openShifts = (shiftPayload.data ?? []) as Shift[];
      setShifts(openShifts);
      setSelectedShiftId(openShifts[0]?.id ?? "");
      setCashReceivedMinor(0);
      if (openShifts[0]) await loadProductsForLocation(openShifts[0].startLocationId);
      else {
        setProducts([]);
        setCreateError("Tidak ada shift terbuka. Mulai operasional terlebih dahulu.");
      }
    } catch (cause) {
      setProducts([]);
      setCreateError(cause instanceof Error ? cause.message : "Data formulir tidak dapat dimuat.");
    }
  }

  async function selectShift(shiftId: string) {
    setSelectedShiftId(shiftId);
    setProducts((current) => current.map((item) => ({ ...item, quantity: 0 })));
    const shift = shifts.find((candidate) => candidate.id === shiftId);
    if (!shift) return;
    setCreateError("");
    try {
      await loadProductsForLocation(shift.startLocationId);
    } catch (cause) {
      setProducts([]);
      setCreateError(cause instanceof Error ? cause.message : "Harga outlet tidak dapat dimuat.");
    }
  }

  function changeQuantity(id: string, delta: number) {
    setProducts((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item));
  }

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    if (!activeShift) return setCreateError("Pilih shift operasional yang masih terbuka.");
    const lines = products.filter((item) => item.quantity > 0).map((item) => ({ menuItemId: item.id, quantity: item.quantity }));
    if (!lines.length) return setCreateError("Pilih minimal satu menu.");
    if (!Number.isSafeInteger(cashReceivedMinor) || cashReceivedMinor < totalMinor) return setCreateError("Uang tunai diterima harus cukup untuk total transaksi.");
    setSaving(true);
    try {
      const clientSaleId = crypto.randomUUID();
      const response = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientSaleId },
        body: JSON.stringify({ shiftId: activeShift.id, clientSaleId, clientPaymentId: crypto.randomUUID(), lines, cashReceivedMinor }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Transaksi tidak tersimpan.");
      setCreating(false);
      setSuccess(`Transaksi tersimpan. Kembalian ${money(payload.data.changeMinor)}.`);
      await loadTransactions();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Transaksi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8f6", color: "#1f2e2a", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/" style={{ color: "inherit" }}>Beranda</a><span aria-hidden="true"> / </span><strong style={{ color: "#173c34" }}>Transaksi</strong></nav>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, margin: "0 0 6px" }}>OPERASIONAL · PENJUALAN</p><h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: 0, color: "#173c34" }}>Transaksi</h1><p style={{ color: "#687a74", margin: "8px 0 0" }}>Catatan penjualan yang tersimpan dan dapat ditelusuri.</p></div>
          <button onClick={() => void openCreateForm()} style={primaryButton}>＋ Catat transaksi</button>
        </header>

        {success && <div role="status" style={noticeStyle("success")}>{success}<button aria-label="Tutup pesan" onClick={() => setSuccess("")} style={closeButton}>×</button></div>}
        <section aria-label="Filter transaksi" style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
          <label style={labelStyle}>Tanggal bisnis<input type="date" value={businessDay} onChange={(e) => setBusinessDay(e.target.value)} style={inputStyle}/></label>
          <label style={labelStyle}>Outlet<select value={stallId} onChange={(e) => setStallId(e.target.value)} style={inputStyle}><option value="">Semua outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
          <label style={labelStyle}>Status<select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}><option value="">Semua status</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <button onClick={() => { setBusinessDay(""); setStallId(""); setStatus(""); }} style={secondaryButton}>Hapus filter</button>
        </section>

        <section style={panel} aria-labelledby="transaction-list-title">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}><div><h2 id="transaction-list-title" style={{ margin: 0, fontSize: 18 }}>Riwayat transaksi</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>{loading ? "Memuat data…" : `${rows.length} transaksi ditampilkan`}</p></div><button onClick={() => void loadTransactions()} style={secondaryButton} disabled={loading}>Muat ulang</button></div>
          {error && <div role="alert" style={noticeStyle("error")}>{error}<button onClick={() => void loadTransactions()} style={{ ...secondaryButton, marginLeft: 12 }}>Coba lagi</button></div>}
          {loading ? <div style={emptyStyle}>Memuat transaksi tersimpan…</div> : !error && rows.length === 0 ? <div style={emptyStyle}><strong>Belum ada transaksi untuk filter ini.</strong><span style={{ display: "block", marginTop: 6 }}>Catatan yang baru dibuat akan muncul di sini setelah tersimpan.</span></div> : !error && (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}><thead><tr>{["TRANSAKSI", "TANGGAL BISNIS", "OUTLET", "ITEM", "PEMBAYARAN", "TOTAL", "STATUS", ""].map((title) => <th key={title} style={thStyle}>{title}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
              <td style={tdStyle}><a href={`/transactions/${encodeURIComponent(row.id)}`} style={{ color: "#087960", fontWeight: 700, textDecoration: "none" }}>#{row.id.slice(0, 8)}</a><small style={{ display: "block", color: "#7b8984", marginTop: 4 }}>{new Date(row.acceptedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB</small></td>
              <td style={tdStyle}>{row.businessDay}</td><td style={tdStyle}>{row.outletName}</td><td style={tdStyle}>{row.lineCount} baris</td>
              <td style={tdStyle}>{row.paymentMethod ? `${row.paymentMethod === "CASH" ? "Tunai" : row.paymentMethod} · ${row.paymentStatus === "PAID" ? "Dibayar" : row.paymentStatus}` : "Belum dibayar"}</td>
              <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{money(row.totalMinor)}</td><td style={tdStyle}><span style={badgeStyle(row.status)}>{statusLabel[row.status] ?? row.status}</span></td>
              <td style={tdStyle}><a href={`/transactions/${encodeURIComponent(row.id)}`} style={{ color: "#087960", textDecoration: "none", fontWeight: 700 }}>Detail →</a></td>
            </tr>)}</tbody></table></div>
          )}
        </section>
        <p style={{ color: "#7b8984", fontSize: 12, marginTop: 14 }}>Pembayaran tunai dicatat langsung. Pembayaran digital tidak tersedia pada formulir ini sampai verifikasi penyedia pembayaran terhubung.</p>
      </div>

      {creating && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCreating(false); }} style={modalBackdrop}><section role="dialog" aria-modal="true" aria-labelledby="create-title" style={modalPanel}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 18 }}><div><h2 id="create-title" style={{ margin: 0, color: "#173c34" }}>Catat transaksi</h2><p style={{ margin: "6px 0 0", color: "#72817c", fontSize: 14 }}>Nilai dan stok dihitung ulang oleh server sebelum disimpan.</p></div><button onClick={() => setCreating(false)} disabled={saving} aria-label="Tutup" style={closeButton}>×</button></header>
        <form onSubmit={(event) => void submitTransaction(event)}>
          {createError && <div role="alert" style={noticeStyle("error")}>{createError}</div>}
          <label style={{ ...labelStyle, marginBottom: 14 }}>Shift terbuka<select required value={selectedShiftId} onChange={(event) => void selectShift(event.target.value)} style={inputStyle}><option value="">Pilih shift</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{outlets.find((o) => o.id === shift.stallId)?.name ?? shift.stallId.slice(0, 8)} · {shift.businessDay}</option>)}</select></label>
          {shifts.length === 0 && !createError && <div style={noticeStyle("error")}>Tidak ada shift terbuka. Mulai operasional terlebih dahulu.</div>}
          <div style={{ maxHeight: 290, overflowY: "auto", borderTop: "1px solid #e8eeeb", borderBottom: "1px solid #e8eeeb", margin: "12px 0" }}>{products.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 2px", borderBottom: "1px solid #eff3f1" }}><div><strong>{item.name}</strong><small style={{ display: "block", color: "#72817c", marginTop: 3 }}>{money(item.priceMinor)}</small></div><div style={{ display: "flex", alignItems: "center", gap: 9 }}><button type="button" aria-label={`Kurangi ${item.name}`} onClick={() => changeQuantity(item.id, -1)} style={stepButton}>−</button><span style={{ minWidth: 20, textAlign: "center" }}>{item.quantity}</span><button type="button" aria-label={`Tambah ${item.name}`} onClick={() => changeQuantity(item.id, 1)} style={stepButton}>＋</button></div></div>)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, padding: "6px 0 14px" }}><span>Total</span><span>{money(totalMinor)}</span></div>
          <label style={{ ...labelStyle, marginBottom: 16 }}>Tunai diterima (Rp)<input required type="number" min={totalMinor || 1} step="1" value={cashReceivedMinor || ""} onChange={(event) => setCashReceivedMinor(Number(event.target.value))} placeholder={String(totalMinor)} style={inputStyle}/></label>
          <div style={{ display: "flex", justifyContent: "end", gap: 10 }}><button type="button" onClick={() => setCreating(false)} disabled={saving} style={secondaryButton}>Batal</button><button type="submit" disabled={saving || shifts.length === 0} style={primaryButton}>{saving ? "Menyimpan…" : "Simpan transaksi"}</button></div>
        </form>
      </section></div>}
    </main>
  );
}

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e1e9e5", borderRadius: 16, padding: "18px 20px", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const primaryButton: React.CSSProperties = { border: 0, background: "#087960", color: "white", fontWeight: 700, borderRadius: 11, padding: "13px 18px", minHeight: 48, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid #dbe5e0", background: "#fff", color: "#31534a", fontWeight: 600, borderRadius: 9, padding: "10px 13px", minHeight: 42, cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#4f655d", fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { minHeight: 44, minWidth: 150, border: "1px solid #dbe5e0", borderRadius: 9, padding: "8px 10px", color: "#203c33", background: "white", font: "inherit" };
const emptyStyle: React.CSSProperties = { padding: "42px 16px", textAlign: "center", color: "#778781", background: "#fafcfb", borderRadius: 12 };
const thStyle: React.CSSProperties = { textAlign: "left", fontSize: 10, letterSpacing: ".08em", color: "#819089", padding: "12px 10px", borderBottom: "1px solid #e9efec", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "14px 10px", borderBottom: "1px solid #edf1ef", fontSize: 13, verticalAlign: "middle" };
const modalBackdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,35,28,.42)", zIndex: 20, display: "grid", placeItems: "center", padding: 14 };
const modalPanel: React.CSSProperties = { background: "white", width: "min(100%, 580px)", maxHeight: "92vh", overflowY: "auto", borderRadius: 18, padding: "22px clamp(16px, 4vw, 28px)", boxShadow: "0 18px 60px rgba(10,35,25,.22)" };
const stepButton: React.CSSProperties = { width: 42, height: 42, border: "1px solid #dbe5e0", background: "white", borderRadius: 10, fontSize: 20, color: "#087960", cursor: "pointer" };
const closeButton: React.CSSProperties = { border: 0, background: "transparent", color: "#587067", fontSize: 25, cursor: "pointer" };
function badgeStyle(status: string): React.CSSProperties { return { display: "inline-block", borderRadius: 999, padding: "5px 9px", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: status === "COMPLETED" ? "#087960" : status === "DRAFT" ? "#946513" : "#5c6b65", background: status === "COMPLETED" ? "#e2f5ee" : status === "DRAFT" ? "#fff4da" : "#eef2f0" }; }
function noticeStyle(tone: "success" | "error"): React.CSSProperties { return { background: tone === "success" ? "#e8f7ef" : "#fff0ef", color: tone === "success" ? "#176b4f" : "#9f352b", border: `1px solid ${tone === "success" ? "#bfe6d1" : "#f0c8c4"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }; }
