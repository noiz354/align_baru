"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ExpenseCategoryCode, ExpensePaidFrom, ExpenseReviewState } from "@/domain/expense/review";

type Expense = {
  id: string; businessDay: string; incurredAt: string; submittedAt: string; shiftId: string;
  stallId: string; outletName: string; category: ExpenseCategoryCode; amountMinor: number;
  currency: "IDR"; paidFrom: ExpensePaidFrom; cashImpact: "REDUCES_EXPECTED_CASH" | "NONE";
  description: string | null; note: string | null; reviewStatus: ExpenseReviewState;
  flaggedReason: string | null; evidenceAvailableInThisRuntime: false; canReview: boolean;
  reviewReason?: string;
};
type Decision = "REVIEWED" | "REJECTED" | "ESCALATED";
const labels: Record<ExpenseCategoryCode, string> = {
  UNVERIFIED_FIELD_EXPENSE: "Biaya lapangan belum terverifikasi", TRANSPORT: "Transportasi", CLEANING: "Kebersihan",
  CONSUMABLE: "Bahan habis pakai", REPAIR_MINOR: "Perbaikan kecil", PARKING: "Parkir", OTHER_OPERATIONAL: "Pengeluaran operasional lain",
};
const statusLabels: Record<ExpenseReviewState, string> = {
  SUBMITTED: "Tercatat", REVIEW_REQUIRED: "Perlu ditinjau", REVIEWED: "Sudah ditinjau",
  REJECTED: "Ditolak — tetap tercatat", ESCALATED: "Diteruskan ke tim terkait",
};
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function ExpenseDetailPage() {
  const params = useParams<{ expenseId: string }>();
  const expenseId = params.expenseId;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Decision | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/expenses/${encodeURIComponent(expenseId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Detail pengeluaran tidak dapat dimuat.");
      setExpense(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Detail pengeluaran tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [expenseId]);
  useEffect(() => { void loadDetail(); }, [loadDetail]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || reason.trim().length < 3) return setActionError("Pilih keputusan dan tulis alasan minimal 3 karakter.");
    setSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/v1/expenses/${encodeURIComponent(expenseId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Keputusan tidak dapat disimpan.");
      setNotice(`Keputusan tersimpan. Status: ${statusLabels[payload.data.newStatus as ExpenseReviewState] ?? payload.data.newStatus}.`);
      setDecision("");
      setReason("");
      await loadDetail();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Keputusan tidak dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return <main style={{ minHeight: "100vh", background: "#f6f8f6", color: "#203c33", fontFamily: "Arial, sans-serif", padding: "24px clamp(16px, 4vw, 56px) 48px" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <nav aria-label="Navigasi" style={{ marginBottom: 24, color: "#687a74", fontSize: 14 }}><a href="/expenses" style={{ color: "#087960", textDecoration: "none" }}>← Kembali ke pengeluaran</a></nav>
      {loading ? <section style={panel} role="status">Memuat detail tersimpan…</section> : error ? <section style={alert}><strong role="alert">Detail tidak tersedia</strong><p>{error}</p><button onClick={() => void loadDetail()} style={secondary}>Coba lagi</button></section> : expense && <>
        <header style={{ display: "flex", gap: 16, alignItems: "start", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 22 }}><div><p style={{ margin: "0 0 8px", color: "#13836c", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>PENGELUARAN · #{expense.id.slice(0, 8)}</p><h1 style={{ margin: 0, color: "#173c34", fontSize: "clamp(26px, 4vw, 36px)" }}>Detail pengeluaran</h1></div><span style={badge(expense.reviewStatus)}>{statusLabels[expense.reviewStatus]}</span></header>
        {notice && <div role="status" style={success}>{notice}</div>}
        <section style={panel} aria-labelledby="expense-info"><h2 id="expense-info" style={{ margin: "0 0 20px", fontSize: 18 }}>Informasi catatan</h2>
          <div style={grid}>
            <Info label="Jumlah" value={money(expense.amountMinor)} emphasized/>
            <Info label="Kategori" value={labels[expense.category] ?? expense.category}/>
            <Info label="Outlet" value={expense.outletName}/>
            <Info label="Tanggal bisnis" value={expense.businessDay}/>
            <Info label="Waktu dicatat" value={time(expense.submittedAt)}/>
            <Info label="Sumber pembayaran" value={expense.paidFrom === "CASH_BOX" ? "Kas operasional" : "Dana pribadi"}/>
            <Info label="Dampak ke kas yang diharapkan" value={expense.cashImpact === "REDUCES_EXPECTED_CASH" ? "Mengurangi kas" : "Tidak mengurangi kas"}/>
            <Info label="Shift" value={expense.shiftId}/>
          </div>
          <div style={{ borderTop: "1px solid #edf1ef", marginTop: 20, paddingTop: 18 }}><p style={fieldLabel}>Catatan</p><p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: expense.description || expense.note ? "#314b42" : "#829089" }}>{expense.description || expense.note || "Tidak ada catatan tambahan."}</p></div>
          {expense.reviewReason && <div style={{ borderTop: "1px solid #edf1ef", marginTop: 18, paddingTop: 18 }}><p style={fieldLabel}>Alasan tinjauan</p><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{expense.reviewReason}</p></div>}
          <div style={{ borderTop: "1px solid #edf1ef", marginTop: 18, paddingTop: 16 }}><p style={{ margin: 0, color: "#76857f", fontSize: 13 }}>Bukti foto: belum tersedia di runtime ini. Catatan biaya tetap dapat disimpan tanpa bukti.</p></div>
        </section>
        {expense.canReview && ["SUBMITTED", "REVIEW_REQUIRED", "ESCALATED"].includes(expense.reviewStatus) && <section style={{ ...panel, marginTop: 16 }} aria-labelledby="review-title"><h2 id="review-title" style={{ margin: "0 0 6px", fontSize: 18 }}>Tinjau catatan</h2><p style={{ margin: "0 0 18px", color: "#72817c", fontSize: 14 }}>Keputusan tidak menghapus atau mengubah jumlah kas historis. Alasan wajib disimpan untuk audit.</p>
          <form onSubmit={(event) => void submitReview(event)}>{actionError && <div role="alert" style={alert}>{actionError}</div>}
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}><legend style={{ ...fieldLabel, marginBottom: 8 }}>Keputusan</legend><div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>{(["REVIEWED", "REJECTED", "ESCALATED"] as Decision[]).map((value) => <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value)} style={{ ...choice, background: decision === value ? "#e2f5ee" : "white", borderColor: decision === value ? "#087960" : "#dbe5e0", color: decision === value ? "#087960" : "#38564c" }}>{value === "REVIEWED" ? "Tandai ditinjau" : value === "REJECTED" ? "Tolak catatan" : "Teruskan"}</button>)}</div></fieldset>
            <label style={{ ...fieldLabel, marginBottom: 16 }}>Alasan (wajib)<textarea required minLength={3} maxLength={300} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tulis alasan keputusan secara singkat" style={textarea}/></label>
            <button type="submit" disabled={saving || !decision || reason.trim().length < 3} style={primary}>{saving ? "Menyimpan…" : "Simpan keputusan"}</button>
          </form>
        </section>}
      </>}
    </div>
  </main>;
}

function Info({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) { return <div><p style={fieldLabel}>{label}</p><p style={{ margin: 0, color: "#253f36", fontWeight: emphasized ? 700 : 500, fontSize: emphasized ? 20 : 14, overflowWrap: "anywhere" }}>{value}</p></div>; }
const panel: React.CSSProperties = { background: "white", border: "1px solid #e1e9e5", borderRadius: 16, padding: "22px clamp(16px, 4vw, 26px)", boxShadow: "0 5px 18px rgba(20,50,40,.035)" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "22px 18px" };
const fieldLabel: React.CSSProperties = { margin: "0 0 6px", color: "#829089", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" };
const badge = (status: ExpenseReviewState): React.CSSProperties => ({ display: "inline-block", borderRadius: 999, padding: "8px 12px", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: status === "REVIEWED" ? "#087960" : status === "REVIEW_REQUIRED" ? "#946513" : status === "REJECTED" ? "#8b3c35" : "#5c6b65", background: status === "REVIEWED" ? "#e2f5ee" : status === "REVIEW_REQUIRED" ? "#fff4da" : status === "REJECTED" ? "#fff0ef" : "#eef2f0" });
const alert: React.CSSProperties = { borderRadius: 10, border: "1px solid #f0c8c4", background: "#fff0ef", color: "#9f352b", padding: 14, marginBottom: 14 };
const success: React.CSSProperties = { borderRadius: 10, border: "1px solid #bfe6d1", background: "#e8f7ef", color: "#176b4f", padding: 14, marginBottom: 14 };
const textarea: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, border: "1px solid #dbe5e0", borderRadius: 9, padding: 11, font: "inherit", resize: "vertical" };
const choice: React.CSSProperties = { border: "1px solid", borderRadius: 9, padding: "10px 13px", minHeight: 42, cursor: "pointer", fontWeight: 600 };
const secondary: React.CSSProperties = { background: "white", border: "1px solid #dbe5e0", borderRadius: 9, padding: "10px 13px", color: "#31534a", cursor: "pointer" };
const primary: React.CSSProperties = { background: "#087960", color: "white", fontWeight: 700, border: 0, borderRadius: 9, padding: "12px 16px", minHeight: 46, cursor: "pointer" };
