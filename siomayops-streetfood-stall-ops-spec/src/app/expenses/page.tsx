"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExpenseCategoryCode, ExpensePaidFrom, ExpenseReviewState } from "@/domain/expense/review";
import { EXPENSE_CATEGORY_CODES } from "@/domain/expense/review";

type Outlet = { id: string; name: string };
type Expense = {
  id: string; businessDay: string; incurredAt: string; submittedAt: string; shiftId: string;
  stallId: string; outletName: string; category: ExpenseCategoryCode; amountMinor: number;
  currency: "IDR"; paidFrom: ExpensePaidFrom; cashImpact: "REDUCES_EXPECTED_CASH" | "NONE";
  description: string | null; note: string | null; reviewStatus: ExpenseReviewState; flaggedReason: string | null;
};
type Shift = { id: string; stallId: string; businessDay: string; status: string };

const categoryLabels: Record<ExpenseCategoryCode, string> = {
  UNVERIFIED_FIELD_EXPENSE: "Biaya lapangan belum terverifikasi",
  TRANSPORT: "Transportasi",
  CLEANING: "Kebersihan",
  CONSUMABLE: "Bahan habis pakai",
  REPAIR_MINOR: "Perbaikan kecil",
  PARKING: "Parkir",
  OTHER_OPERATIONAL: "Pengeluaran operasional lain",
};
const stateLabels: Record<ExpenseReviewState, string> = {
  SUBMITTED: "Tercatat",
  REVIEW_REQUIRED: "Perlu ditinjau",
  REVIEWED: "Sudah ditinjau",
  REJECTED: "Ditolak — tetap tercatat",
  ESCALATED: "Diteruskan ke tim terkait",
};
const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [businessDay, setBusinessDay] = useState("");
  const [stallId, setStallId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftId, setShiftId] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryCode | "">("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFrom>("CASH_BOX");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [notice, setNotice] = useState("");

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (businessDay) params.set("businessDay", businessDay);
      if (stallId) params.set("stallId", stallId);
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("reviewStatus", statusFilter);
      const response = await fetch(`/api/v1/expenses?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Pengeluaran tidak dapat dimuat.");
      setRows(payload.data ?? []);
      setTotalCount(payload.pagination?.total ?? 0);
      setOutlets(payload.outlets ?? []);
      setCanSubmit(payload.canSubmit === true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Terjadi gangguan saat memuat pengeluaran.");
    } finally {
      setLoading(false);
    }
  }, [businessDay, stallId, categoryFilter, statusFilter]);

  useEffect(() => { void loadExpenses(); }, [loadExpenses]);
  const selectedShift = shifts.find((shift) => shift.id === shiftId);

  async function openCreate() {
    setNotice("");
    setCreateError("");
    setShowCreate(true);
    setCategory("");
    setAmountMinor(0);
    setPaidFrom("CASH_BOX");
    setDescription("");
    try {
      const response = await fetch("/api/v1/shifts?status=OPEN&limit=100", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Shift terbuka tidak dapat dimuat.");
      const openShifts = (payload.data ?? []) as Shift[];
      setShifts(openShifts);
      setShiftId(openShifts[0]?.id ?? "");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Shift terbuka tidak dapat dimuat.");
    }
  }

  async function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    if (!selectedShift) return setCreateError("Pilih shift operasional yang masih terbuka.");
    if (!category) return setCreateError("Pilih kategori.");
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return setCreateError("Masukkan jumlah lebih dari nol.");
    setSaving(true);
    const clientExpenseId = crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientExpenseId },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          categoryCode: category,
          amount: { amountMinor, currency: "IDR" },
          paidFrom,
          ...(description.trim() ? { description: description.trim() } : {}),
          clientExpenseId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Pengeluaran tidak tersimpan.");
      setShowCreate(false);
      setNotice(`Pengeluaran tersimpan dengan status “${stateLabels[payload.data.reviewStatus as ExpenseReviewState] ?? payload.data.reviewStatus}”.`);
      await loadExpenses();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Pengeluaran gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8f6", color: "#1f2e2a", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <nav aria-label="Navigasi" style={{ color: "#65736e", fontSize: 14, marginBottom: 22 }}><a href="/" style={{ color: "inherit" }}>Beranda</a><span aria-hidden="true"> / </span><strong style={{ color: "#173c34" }}>Pengeluaran</strong></nav>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div><p style={{ color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1.2, margin: "0 0 6px" }}>OPERASIONAL · CATATAN BIAYA</p><h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", margin: 0, color: "#173c34" }}>Pengeluaran</h1><p style={{ color: "#687a74", margin: "8px 0 0" }}>Catat apa yang dilaporkan, dengan kategori netral. Catatan dan bukti bersifat opsional.</p></div>
          {canSubmit && <button onClick={() => void openCreate()} style={primaryButton}>＋ Catat pengeluaran</button>}
        </header>
        {notice && <div role="status" style={noticeStyle("success")}>{notice}<button onClick={() => setNotice("")} aria-label="Tutup pesan" style={closeButton}>×</button></div>}

        <section aria-label="Filter pengeluaran" style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
          <label style={labelStyle}>Tanggal bisnis<input type="date" value={businessDay} onChange={(event) => setBusinessDay(event.target.value)} style={inputStyle}/></label>
          <label style={labelStyle}>Outlet<select value={stallId} onChange={(event) => setStallId(event.target.value)} style={inputStyle}><option value="">Semua outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
          <label style={labelStyle}>Kategori<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={inputStyle}><option value="">Semua kategori</option>{EXPENSE_CATEGORY_CODES.map((code) => <option key={code} value={code}>{categoryLabels[code]}</option>)}</select></label>
          <label style={labelStyle}>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}><option value="">Semua status</option>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button onClick={() => { setBusinessDay(""); setStallId(""); setCategoryFilter(""); setStatusFilter(""); }} style={secondaryButton}>Hapus filter</button>
        </section>

        <section style={panel} aria-labelledby="expense-list-title">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}><div><h2 id="expense-list-title" style={{ margin: 0, fontSize: 18 }}>Riwayat pengeluaran</h2><p style={{ margin: "5px 0 0", color: "#72817c", fontSize: 13 }}>{loading ? "Memuat data…" : `${rows.length} ditampilkan dari ${totalCount} catatan`}</p></div><button onClick={() => void loadExpenses()} style={secondaryButton} disabled={loading}>Muat ulang</button></div>
          {loadError && <div role="alert" style={noticeStyle("error")}>{loadError}<button onClick={() => void loadExpenses()} style={{ ...secondaryButton, marginLeft: 12 }}>Coba lagi</button></div>}
          {loading ? <div style={emptyStyle}>Memuat catatan tersimpan…</div> : !loadError && rows.length === 0 ? <div style={emptyStyle}><strong>Belum ada pengeluaran untuk filter ini.</strong><span style={{ display: "block", marginTop: 6 }}>Catatan baru akan muncul setelah tersimpan di server.</span></div> : !loadError && (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}><thead><tr>{["CATATAN", "TANGGAL", "OUTLET", "KATEGORI", "DIBAYAR DARI", "JUMLAH", "STATUS", ""].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
              <td style={tdStyle}><a href={`/expenses/${encodeURIComponent(row.id)}`} style={{ color: "#087960", fontWeight: 700, textDecoration: "none" }}>#{row.id.slice(0, 8)}</a><small style={{ display: "block", color: "#7b8984", marginTop: 4 }}>{row.description || "Tanpa catatan tambahan"}</small></td>
              <td style={tdStyle}>{row.businessDay}</td><td style={tdStyle}>{row.outletName}</td><td style={tdStyle}>{categoryLabels[row.category] ?? row.category}</td>
              <td style={tdStyle}>{row.paidFrom === "CASH_BOX" ? "Kas operasional" : "Dana pribadi"}</td><td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{rupiah(row.amountMinor)}</td>
              <td style={tdStyle}><span style={badgeStyle(row.reviewStatus)}>{stateLabels[row.reviewStatus]}</span></td><td style={tdStyle}><a href={`/expenses/${encodeURIComponent(row.id)}`} style={{ color: "#087960", textDecoration: "none", fontWeight: 700 }}>Detail →</a></td>
            </tr>)}</tbody></table></div>
          )}
        </section>
        <p style={{ color: "#778781", fontSize: 12, marginTop: 14 }}>Bukti foto tidak wajib. Fitur unggah dan melihat bukti belum tersedia di halaman ini.</p>
      </div>

      {showCreate && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }} style={modalBackdrop}><section role="dialog" aria-modal="true" aria-labelledby="create-expense-title" style={modalPanel}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 18 }}><div><h2 id="create-expense-title" style={{ margin: 0, color: "#173c34" }}>Catat pengeluaran</h2><p style={{ margin: "6px 0 0", color: "#72817c", fontSize: 14 }}>Kategori dan jumlah wajib. Catatan boleh dikosongkan.</p></div><button onClick={() => setShowCreate(false)} disabled={saving} aria-label="Tutup" style={closeButton}>×</button></header>
        <form onSubmit={(event) => void submitExpense(event)}>
          {createError && <div role="alert" style={noticeStyle("error")}>{createError}</div>}
          <label style={{ ...labelStyle, marginBottom: 14 }}>Shift operasional<select required value={shiftId} onChange={(event) => setShiftId(event.target.value)} style={inputStyle}><option value="">Pilih shift terbuka</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{outlets.find((outlet) => outlet.id === shift.stallId)?.name ?? shift.stallId.slice(0, 8)} · {shift.businessDay}</option>)}</select></label>
          {shifts.length === 0 && !createError && <div style={noticeStyle("error")}>Tidak ada shift terbuka. Pengeluaran harus terkait dengan operasional yang aktif.</div>}
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}><legend style={{ ...labelStyle, marginBottom: 8 }}>Kategori <span aria-hidden="true">*</span></legend><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>{EXPENSE_CATEGORY_CODES.map((code) => <button key={code} type="button" aria-pressed={category === code} onClick={() => setCategory(code)} style={{ ...chipStyle, borderColor: category === code ? "#087960" : "#dbe5e0", background: category === code ? "#e2f5ee" : "white", color: category === code ? "#087960" : "#38564c" }}>{categoryLabels[code]}</button>)}</div></fieldset>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Jumlah (Rp)<input required type="number" min="1" step="1" value={amountMinor || ""} onChange={(event) => setAmountMinor(Number(event.target.value))} placeholder="Masukkan jumlah" style={inputStyle}/></label>
          <label style={{ ...labelStyle, marginBottom: 14 }}>Dibayar dari<select value={paidFrom} onChange={(event) => setPaidFrom(event.target.value as ExpensePaidFrom)} style={inputStyle}><option value="CASH_BOX">Kas operasional (mengurangi kas yang diharapkan)</option><option value="PERSONAL">Dana pribadi (tidak mengurangi kas operasional)</option></select></label>
          <label style={{ ...labelStyle, marginBottom: 16 }}>Catatan singkat (opsional)<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={3} placeholder="Tidak perlu menyebut penerima atau pihak lain." style={{ ...inputStyle, resize: "vertical" }}/></label>
          <div style={{ display: "flex", justifyContent: "end", gap: 10 }}><button type="button" onClick={() => setShowCreate(false)} disabled={saving} style={secondaryButton}>Batal</button><button type="submit" disabled={saving || shifts.length === 0} style={primaryButton}>{saving ? "Menyimpan…" : "Simpan pengeluaran"}</button></div>
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
const closeButton: React.CSSProperties = { border: 0, background: "transparent", color: "#587067", fontSize: 25, cursor: "pointer" };
const chipStyle: React.CSSProperties = { minHeight: 48, padding: "8px 10px", border: "1px solid", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 };
function badgeStyle(status: ExpenseReviewState): React.CSSProperties { return { display: "inline-block", borderRadius: 999, padding: "5px 9px", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: status === "REVIEWED" ? "#087960" : status === "REVIEW_REQUIRED" ? "#946513" : status === "REJECTED" ? "#8b3c35" : "#5c6b65", background: status === "REVIEWED" ? "#e2f5ee" : status === "REVIEW_REQUIRED" ? "#fff4da" : status === "REJECTED" ? "#fff0ef" : "#eef2f0" }; }
function noticeStyle(tone: "success" | "error"): React.CSSProperties { return { background: tone === "success" ? "#e8f7ef" : "#fff0ef", color: tone === "success" ? "#176b4f" : "#9f352b", border: `1px solid ${tone === "success" ? "#bfe6d1" : "#f0c8c4"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }; }
