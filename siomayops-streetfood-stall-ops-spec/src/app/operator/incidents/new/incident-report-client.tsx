"use client";

import { useCallback, useEffect, useState } from "react";

type AmountContext = "REQUESTED" | "PAID" | "UNCLEAR";
type SeverityHint = "P1" | "P2" | "P3";
interface Category { code: string; label: string; help: string }
interface IncidentReport {
  id: string;
  categoryCode: string;
  severityHint: SeverityHint | null;
  description: string;
  occurredAt: string;
  reportedAt: string;
  amountMinor: number | null;
  amountContext: AmountContext | null;
  locationName: string | null;
  status: string;
}
interface PageData {
  generatedAt: string;
  environment: "DEVELOPMENT" | "PRODUCTION";
  operatorName: string | null;
  activeShift: null | { businessDay: string; stallCode: string };
  currentLocation: null | { name: string; status: string };
  locationLinked: boolean;
  categories: Category[];
  reports: IncidentReport[];
  evidenceUploadStatus: "UNSUPPORTED";
}

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e0e4e1", borderRadius: 14, padding: 18, marginTop: 14 };
const field: React.CSSProperties = { display: "block", width: "100%", minHeight: 48, boxSizing: "border-box", border: "1px solid #aab8af", borderRadius: 8, padding: "10px 12px", font: "inherit", background: "#fff", color: "#17251d" };
const button: React.CSSProperties = { minHeight: 48, border: 0, borderRadius: 9, padding: "11px 16px", fontWeight: 750, fontSize: 16, cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 700, margin: "12px 0 6px" };
const statusLabel: Record<string, string> = { SUBMITTED: "Terkirim untuk ditinjau", ACKNOWLEDGED: "Diterima", INVESTIGATING: "Sedang ditinjau", ESCALATED: "Diteruskan untuk tindak lanjut", RESOLVED: "Ditandai selesai", CLOSED: "Ditutup" };
const severityLabel: Record<SeverityHint, string> = { P1: "P1 · Perlu bantuan manusia segera", P2: "P2 · Perlu tindak lanjut hari ini", P3: "P3 · Dapat ditinjau pada alur normal" };
const amountLabel: Record<AmountContext, string> = { REQUESTED: "Dilaporkan diminta", PAID: "Dilaporkan dibayarkan", UNCLEAR: "Belum jelas" };

function initialJakartaLocalTime(): string {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce<Record<string, string>>((all, part) => { all[part.type] = part.value; return all; }, {});
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
function jakartaInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
function errorMessage(response: Response, body: any): string {
  if (response.status === 401) return "Sesi berakhir. Masuk kembali untuk melanjutkan.";
  if (response.status === 403) return "Akun ini tidak memiliki akses untuk mengirim laporan operator.";
  if (response.status === 404) return "Laporan tidak ditemukan atau tidak dapat diakses dari akun ini.";
  if (response.status === 409 || response.status === 422) return "ID laporan sudah dipakai dengan isi berbeda. Muat ulang dan periksa laporan.";
  if (response.status === 400) return "Periksa kategori, waktu kejadian, uraian, dan jumlah yang dimasukkan.";
  return body?.error?.message || "Laporan belum dapat diproses. Coba lagi.";
}

export default function OperatorIncidentReportClient() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [retryIdentity, setRetryIdentity] = useState<{ fingerprint: string; clientIncidentId: string } | null>(null);
  const [categoryCode, setCategoryCode] = useState("");
  const [severityHint, setSeverityHint] = useState<SeverityHint | "">("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [hasAmount, setHasAmount] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountContext, setAmountContext] = useState<AmountContext | "">("");

  const load = useCallback(async (initial = false) => {
    setPageError("");
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch("/api/v1/incidents", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(response, body));
      setData(body as PageData);
    } finally {
      if (!initial) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setOccurredAt(initialJakartaLocalTime());
    let active = true;
    void load(true)
      .catch((error) => { if (active) setPageError(error instanceof Error ? error.message : "Halaman laporan tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const refresh = async () => {
    try { await load(); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Data belum dapat dimuat."); }
    finally { setRefreshing(false); }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    if (!categoryCode || description.trim().length < 10 || !occurredAt) {
      setFormError("Pilih kategori, waktu kejadian, dan tulis ringkasan minimal 10 karakter.");
      return;
    }
    const amountMinor = hasAmount ? Number(amount) : undefined;
    if (hasAmount && (!Number.isSafeInteger(amountMinor) || amountMinor! < 1 || !amountContext)) {
      setFormError("Masukkan jumlah IDR bulat positif dan pilih apakah dilaporkan diminta, dibayarkan, atau belum jelas.");
      return;
    }
    setSaving(true);
    const report = {
      categoryCode,
      ...(severityHint ? { severityHint } : {}),
      description: description.trim(),
      occurredAt: jakartaInputToIso(occurredAt),
      ...(hasAmount ? { amountMinor, amountContext } : {}),
    };
    const fingerprint = JSON.stringify(report);
    const clientIncidentId = retryIdentity?.fingerprint === fingerprint ? retryIdentity.clientIncidentId : crypto.randomUUID();
    setRetryIdentity({ fingerprint, clientIncidentId });
    try {
      const response = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientIncidentId },
        body: JSON.stringify({ ...report, clientIncidentId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(response, body));
      setNotice(response.headers.get("X-Idempotent-Replayed") === "true" ? "Laporan ini sudah tersimpan; tidak dibuat duplikat." : "Laporan tersimpan untuk ditinjau.");
      setRetryIdentity(null);
      setCategoryCode("");
      setSeverityHint("");
      setDescription("");
      setHasAmount(false);
      setAmount("");
      setAmountContext("");
      try { await load(); }
      catch (error) { setPageError(`Laporan sudah tersimpan, tetapi daftar belum termuat. ${error instanceof Error ? error.message : "Muat ulang halaman."}`); }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Laporan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/operator" style={{ color: "#286447", fontWeight: 700 }}>← Beranda operator</a>
      <header style={{ marginTop: 14 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Keamanan & kejadian</p>
        <h1 style={{ margin: "5px 0", fontSize: 30 }}>Laporkan kejadian</h1>
        <p style={{ margin: 0, color: "#59685f" }}>Catatan ini merekam laporan Anda; sistem tidak menetapkan pelanggaran, menyimpulkan siapa yang bersalah, atau mengidentifikasi seseorang sebagai pelaku.</p>
      </header>

      {data?.environment === "DEVELOPMENT" && <div role="status" style={{ ...panel, background: "#fff8dc", borderColor: "#e7d489" }}>Konteks shift dan lokasi berasal dari fixture pengembangan, bukan laporan operasional nyata.</div>}
      <section style={{ ...panel, background: "#fff9ed", borderColor: "#e5d2a4" }} aria-label="Bantuan darurat">
        <strong>Jika ada bahaya segera</strong>
        <p style={{ margin: "5px 0 0" }}>Hubungi bantuan darurat atau pengawas melalui cara yang biasa Anda gunakan. Aplikasi ini bukan layanan darurat dan laporan tidak menjamin respons langsung.</p>
      </section>

      {loading && <section role="status" style={panel}>Memuat konteks operator…</section>}
      {!loading && pageError && <section role="alert" style={{ ...panel, color: "#8c2b24", borderColor: "#dfaaa5" }}>{pageError}<button type="button" onClick={refresh} disabled={refreshing} style={{ ...button, marginLeft: 10, background: "#f0f3f1", color: "#17251d" }}>{refreshing ? "Memuat…" : "Coba lagi"}</button></section>}
      {notice && <p role="status" style={{ ...panel, background: "#eff8f1", color: "#195432" }}>{notice}</p>}

      {!loading && data && !pageError && <>
        <section style={panel} aria-label="Konteks laporan">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Konteks dari sesi</h2>
          <p style={{ margin: "4px 0" }}><strong>{data.operatorName || "Operator"}</strong></p>
          {data.locationLinked && data.activeShift && data.currentLocation ? <>
            <p style={{ margin: "4px 0" }}>Titik saat ini: <strong>{data.currentLocation.name}</strong> · shift {data.activeShift.stallCode} · {data.activeShift.businessDay}</p>
            <p style={{ margin: "4px 0 0", color: "#5a6b61", fontSize: 13 }}>Tautan lokasi/shift ditentukan server dari sesi dan shift aktif—bukan dari nilai yang dikirim formulir.</p>
          </> : <p style={{ margin: "4px 0 0", color: "#5a6b61" }}>Tidak ada titik jual/shift aktif untuk ditautkan. Laporan tetap dapat dikirim dan akan tersimpan tanpa tautan lokasi atau shift.</p>}
        </section>

        <form onSubmit={submit} noValidate style={panel}>
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Keterangan kejadian</h2>
          <label style={labelStyle} htmlFor="incident-category">Kategori</label>
          <select id="incident-category" required value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} style={field}>
            <option value="">Pilih kategori…</option>
            {data.categories.map((category) => <option key={category.code} value={category.code}>{category.label}</option>)}
          </select>
          {categoryCode && <p style={{ color: "#5b6d62", fontSize: 13, margin: "6px 0 0" }}>{data.categories.find((item) => item.code === categoryCode)?.help}</p>}

          <label style={labelStyle} htmlFor="incident-occurred-at">Waktu kejadian (WIB / Asia-Jakarta)</label>
          <input id="incident-occurred-at" type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} style={field} />

          <label style={labelStyle} htmlFor="incident-severity">Tingkat urgensi menurut Anda (opsional)</label>
          <select id="incident-severity" value={severityHint} onChange={(event) => setSeverityHint(event.target.value as SeverityHint | "")} style={field}>
            <option value="">Tidak memilih</option>
            <option value="P1">P1 — perlu bantuan manusia segera</option>
            <option value="P2">P2 — perlu tindak lanjut hari ini</option>
            <option value="P3">P3 — dapat ditinjau pada alur normal</option>
          </select>
          <p style={{ color: "#5b6d62", fontSize: 13, margin: "6px 0 0" }}>Ini hanya pandangan urgensi Anda, bukan penilaian otomatis atau kesimpulan tentang kejadian.</p>

          <label style={labelStyle} htmlFor="incident-description">Ringkasan dengan kata-kata Anda</label>
          <textarea id="incident-description" required minLength={10} maxLength={2000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Jelaskan apa yang Anda alami/lihat dan urutannya. Hindari nama, nomor telepon, tuduhan, atau data identitas pihak lain yang tidak diperlukan." style={{ ...field, minHeight: 132, resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#64746a", fontSize: 12, marginTop: 4 }}><span>Jangan masukkan PIN, kata sandi, atau kredensial.</span><span>{description.length}/2000</span></div>

          <fieldset style={{ border: "1px solid #d8dfda", borderRadius: 9, margin: "16px 0 0", padding: 12 }}>
            <legend style={{ fontWeight: 700, padding: "0 5px" }}>Jumlah uang terkait (opsional)</legend>
            <label style={{ display: "flex", gap: 9, alignItems: "center", minHeight: 40 }}><input type="checkbox" checked={hasAmount} onChange={(event) => { setHasAmount(event.target.checked); if (!event.target.checked) { setAmount(""); setAmountContext(""); } }} />Ada jumlah yang ingin dicatat</label>
            {hasAmount && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <div><label style={labelStyle} htmlFor="incident-amount">Jumlah IDR (angka bulat)</label><input id="incident-amount" type="number" min="1" max="1000000000" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} style={field} placeholder="Contoh: 50000" /></div>
              <div><label style={labelStyle} htmlFor="incident-amount-context">Konteks jumlah</label><select id="incident-amount-context" value={amountContext} onChange={(event) => setAmountContext(event.target.value as AmountContext | "")} style={field}><option value="">Pilih…</option><option value="REQUESTED">Dilaporkan diminta</option><option value="PAID">Dilaporkan dibayarkan</option><option value="UNCLEAR">Belum jelas</option></select></div>
            </div>}
            <p style={{ color: "#5b6d62", fontSize: 13, margin: "8px 0 0" }}>Nilai yang Anda laporkan saja; bukan hasil verifikasi atau kesimpulan hukum.</p>
          </fieldset>

          <section aria-label="Bukti lampiran belum tersedia" style={{ marginTop: 16, border: "1px dashed #aebbb2", borderRadius: 9, padding: 12, background: "#f7f9f7" }}>
            <strong>Bukti foto atau berkas: belum tersedia</strong>
            <p style={{ margin: "5px 0 0", color: "#5b6d62", fontSize: 13 }}>Penyimpanan dan akses bukti yang aman belum terhubung. Jangan unggah atau menempelkan tautan berkas pribadi di sini. Anda tetap dapat mengirim laporan tanpa lampiran.</p>
          </section>

          {formError && <p role="alert" style={{ color: "#8c2b24", fontWeight: 650 }}>{formError}</p>}
          <button type="submit" disabled={saving} style={{ ...button, width: "100%", marginTop: 16, background: saving ? "#96a69b" : "#7e3029", color: "#fff" }}>{saving ? "Menyimpan laporan…" : "Kirim laporan"}</button>
        </form>

        <section style={panel} aria-label="Riwayat laporan saya">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2 style={{ margin: 0, fontSize: 19 }}>Laporan terbaru Anda</h2><button type="button" onClick={refresh} disabled={refreshing} style={{ ...button, background: "#eef3ef", color: "#1b422e" }}>{refreshing ? "Memuat…" : "Muat ulang"}</button></div>
          {data.reports.length === 0 ? <p style={{ color: "#5b6d62" }}>Belum ada laporan yang tersimpan untuk akun ini.</p> : <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {data.reports.map((report) => <article key={report.id} style={{ border: "1px solid #e1e6e2", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{data.categories.find((item) => item.code === report.categoryCode)?.label ?? "Kategori laporan"}</strong><span style={{ color: "#315d43", fontWeight: 700 }}>{statusLabel[report.status] ?? "Terkirim"}</span></div>
              <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{report.description}</p>
              <p style={{ margin: 0, color: "#59685f", fontSize: 13 }}>Kejadian: {formatDate(report.occurredAt)} · Dilaporkan: {formatDate(report.reportedAt)}{report.locationName ? ` · ${report.locationName}` : " · Tanpa tautan lokasi"}</p>
              {report.severityHint && <p style={{ margin: "5px 0 0", color: "#59685f", fontSize: 13 }}>Urgensi menurut operator: {severityLabel[report.severityHint]}</p>}
              {report.amountMinor !== null && <p style={{ margin: "5px 0 0", color: "#59685f", fontSize: 13 }}>Jumlah yang dilaporkan {amountLabel[report.amountContext ?? "UNCLEAR"]}: {rupiah(report.amountMinor)}</p>}
            </article>)}
          </div>}
        </section>
      </>}
    </main>
  );
}
