"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "SUBMITTED" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "ESCALATED" | "CLOSED";
interface ReviewEvent {
  id: string;
  action: string;
  occurredAt: string;
  actorKind: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
}
interface IncidentDetail {
  id: string;
  categoryCode: string;
  categoryLabel: string | null;
  description: string;
  status: Status;
  severityHint: "P1" | "P2" | "P3" | null;
  amountMinor: number | null;
  amountContext: "REQUESTED" | "PAID" | "UNCLEAR" | null;
  occurredAt: string;
  reportedAt: string;
  reporterName: string | null;
  stallCode: string | null;
  locationName: string | null;
  evidence: { status: "UNSUPPORTED"; items: [] };
  reviewHistory: ReviewEvent[];
  allowedNextStatuses: Status[];
}
const statusLabel: Record<Status, string> = {
  SUBMITTED: "Terkirim untuk ditinjau", ACKNOWLEDGED: "Diterima", INVESTIGATING: "Sedang ditinjau",
  RESOLVED: "Ditandai selesai", ESCALATED: "Diteruskan untuk tindak lanjut", CLOSED: "Ditutup",
};
const amountContextLabel: Record<"REQUESTED" | "PAID" | "UNCLEAR", string> = {
  REQUESTED: "dilaporkan diminta", PAID: "dilaporkan dibayarkan", UNCLEAR: "belum jelas",
};
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
function rupiah(minor: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(minor);
}
function responseError(status: number, body: any) {
  if (status === 401) return "Sesi berakhir. Masuk kembali untuk melanjutkan.";
  if (status === 403) return "Akun atau cakupan area Anda tidak dapat meninjau laporan ini.";
  if (status === 404) return "Laporan tidak ditemukan atau berada di luar cakupan akses Anda.";
  if (status === 400) return "Periksa status dan catatan tindak lanjut yang dimasukkan.";
  if (status === 409 || status === 422) return "Perubahan tidak dapat diterapkan atau kunci laporan sudah dipakai dengan isi berbeda.";
  return body?.error?.message || "Laporan belum dapat diproses.";
}
function historyHeading(item: ReviewEvent) {
  if (item.action === "incident.submitted") return "Laporan diterima";
  if (item.action === "incident.review_note_added") return "Catatan tindak lanjut ditambahkan";
  if (item.action === "incident.transitioned" && item.toStatus) return `Status: ${item.fromStatus ?? "—"} → ${item.toStatus}`;
  return "Perubahan tercatat";
}

export default function IncidentReviewClient({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [nextStatus, setNextStatus] = useState<Status | "">("");
  const [note, setNote] = useState("");
  const [retryIdentity, setRetryIdentity] = useState<{ fingerprint: string; clientReviewId: string } | null>(null);

  const load = useCallback(async (initial = false) => {
    setPageError("");
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch(`/api/v1/hq/incidents/${encodeURIComponent(incidentId)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(response.status, body));
      setIncident(body.incident as IncidentDetail);
    } finally {
      if (!initial) setRefreshing(false);
    }
  }, [incidentId]);

  useEffect(() => {
    let active = true;
    void load(true)
      .catch((error) => { if (active) setPageError(error instanceof Error ? error.message : "Laporan belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const refresh = async () => {
    try { await load(); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Laporan belum dapat dimuat."); }
    finally { setRefreshing(false); }
  };

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    if (!nextStatus && note.trim().length < 10) {
      setFormError("Pilih perubahan status atau tulis catatan tindak lanjut minimal 10 karakter.");
      return;
    }
    if ((nextStatus === "RESOLVED" || nextStatus === "CLOSED") && note.trim().length < 10) {
      setFormError("Catatan faktual minimal 10 karakter diperlukan untuk menandai selesai atau menutup laporan.");
      return;
    }
    setSaving(true);
    const review = { ...(nextStatus ? { status: nextStatus } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
    const fingerprint = JSON.stringify(review);
    const clientReviewId = retryIdentity?.fingerprint === fingerprint ? retryIdentity.clientReviewId : crypto.randomUUID();
    setRetryIdentity({ fingerprint, clientReviewId });
    try {
      const response = await fetch(`/api/v1/hq/incidents/${encodeURIComponent(incidentId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientReviewId },
        body: JSON.stringify({ ...review, clientReviewId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(response.status, body));
      setNotice(response.headers.get("X-Idempotent-Replayed") === "true" ? "Perubahan ini sudah tersimpan; duplikat tidak dibuat." : "Tindak lanjut tersimpan.");
      setRetryIdentity(null);
      setNextStatus("");
      setNote("");
      try { await load(); }
      catch (error) { setPageError(`Perubahan sudah tersimpan, tetapi riwayat belum termuat. ${error instanceof Error ? error.message : "Muat ulang halaman."}`); }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Tindak lanjut belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/hq/incidents" style={{ color: "#286447", fontWeight: 700 }}>← Kembali ke laporan insiden</a>
      <header style={{ marginTop: 14 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Tinjauan manusia</p>
        <h1 style={{ margin: "5px 0", fontSize: 28 }}>Detail laporan insiden</h1>
        <p style={{ margin: 0, color: "#59685f" }}>Laporan adalah keterangan pelapor, bukan temuan atau penetapan kesalahan seseorang.</p>
      </header>
      {loading && <section role="status" style={{ marginTop: 16, padding: 16, border: "1px solid #dfe5e0", borderRadius: 12 }}>Memuat laporan…</section>}
      {!loading && pageError && <section role="alert" style={{ marginTop: 16, padding: 16, border: "1px solid #dfaaa5", borderRadius: 12, color: "#8c2b24" }}>{pageError}<button type="button" onClick={refresh} disabled={refreshing} style={{ marginLeft: 10, minHeight: 44, padding: "0 12px" }}>{refreshing ? "Memuat…" : "Coba lagi"}</button></section>}
      {notice && <p role="status" style={{ marginTop: 16, padding: 14, border: "1px solid #b9d9c2", borderRadius: 10, background: "#eff8f1", color: "#195432" }}>{notice}</p>}
      {!loading && incident && !pageError && <>
        <section aria-label="Fakta laporan" style={{ marginTop: 16, padding: 18, border: "1px solid #dfe5e0", borderRadius: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><p style={{ margin: 0, color: "#68776e", fontSize: 12 }}>Kategori laporan · {incident.categoryCode}</p><h2 style={{ margin: "4px 0", fontSize: 20 }}>{incident.categoryLabel ?? "Kategori tidak dikenal"}</h2></div>
            <span style={{ alignSelf: "flex-start", padding: "6px 11px", borderRadius: 999, background: "#edf4ef", color: "#315d43", fontWeight: 700 }}>{statusLabel[incident.status] ?? incident.status}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, margin: "14px 0" }}>{incident.description}</p>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: 0 }}>
            <div><dt style={{ color: "#68776e", fontSize: 12 }}>Pelapor</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{incident.reporterName ?? "Operator tidak tersedia"}</dd></div>
            <div><dt style={{ color: "#68776e", fontSize: 12 }}>Titik / unit</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{[incident.stallCode, incident.locationName].filter(Boolean).join(" · ") || "Tidak tertaut"}</dd></div>
            <div><dt style={{ color: "#68776e", fontSize: 12 }}>Waktu kejadian (WIB)</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{dateLabel(incident.occurredAt)}</dd></div>
            <div><dt style={{ color: "#68776e", fontSize: 12 }}>Waktu dilaporkan</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{dateLabel(incident.reportedAt)}</dd></div>
            {incident.severityHint && <div><dt style={{ color: "#68776e", fontSize: 12 }}>Urgensi menurut pelapor</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{incident.severityHint} · bukan penilaian sistem</dd></div>}
            {incident.amountMinor !== null && <div><dt style={{ color: "#68776e", fontSize: 12 }}>Jumlah yang dilaporkan</dt><dd style={{ margin: "3px 0 0", fontWeight: 650 }}>{rupiah(incident.amountMinor)} · {amountContextLabel[incident.amountContext ?? "UNCLEAR"]}</dd></div>}
          </dl>
          <p style={{ margin: "14px 0 0", color: "#68776e", fontSize: 12 }}>ID laporan: {incident.id}</p>
        </section>

        <section aria-label="Bukti insiden" style={{ marginTop: 14, padding: 18, border: "1px dashed #aebbb2", borderRadius: 12, background: "#f7f9f7" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Bukti</h2>
          <p style={{ margin: 0, color: "#536259" }}>Tinjauan foto, video, audio, dan metadata bukti belum tersedia. Laporan ini tidak memiliki bukti yang dapat dibuka melalui sistem. Tidak ada pratinjau, tautan unduh, atau bukti contoh.</p>
        </section>

        <section aria-label="Riwayat peninjauan" style={{ marginTop: 14, padding: 18, border: "1px solid #dfe5e0", borderRadius: 12, background: "#fff" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Riwayat laporan dan tindak lanjut</h2>
          {incident.reviewHistory.length === 0 ? <p style={{ color: "#68776e" }}>Riwayat belum tersedia.</p> : <ol style={{ display: "grid", gap: 12, margin: 0, paddingLeft: 22 }}>
            {incident.reviewHistory.map((item) => <li key={item.id}>
              <strong>{historyHeading(item)}</strong><div style={{ color: "#68776e", fontSize: 13 }}>{dateLabel(item.occurredAt)} · {item.actorKind === "OPERATOR" ? "Operator" : "HQ/pengawas"}</div>
              {item.note && <p style={{ whiteSpace: "pre-wrap", margin: "5px 0 0" }}>{item.note}</p>}
            </li>)}
          </ol>}
        </section>

        <form onSubmit={submitReview} noValidate style={{ marginTop: 14, padding: 18, border: "1px solid #dfe5e0", borderRadius: 12, background: "#fff" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Tindak lanjut</h2>
          <p style={{ margin: "0 0 10px", color: "#68776e", fontSize: 13 }}>Gunakan catatan faktual yang diperlukan. Hindari nama, nomor kontak, identitas pihak lain, atau kesimpulan hukum yang tidak diperlukan.</p>
          <label htmlFor="incident-next-status" style={{ display: "block", fontWeight: 700, margin: "10px 0 6px" }}>Perubahan status (opsional)</label>
          <select id="incident-next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as Status | "")} style={{ display: "block", width: "100%", minHeight: 48, boxSizing: "border-box", border: "1px solid #aab8af", borderRadius: 8, padding: "10px 12px", font: "inherit", background: "#fff" }}>
            <option value="">Tidak mengubah status — hanya catatan</option>
            {incident.allowedNextStatuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
          </select>
          <label htmlFor="incident-follow-up-note" style={{ display: "block", fontWeight: 700, margin: "12px 0 6px" }}>Catatan tindak lanjut</label>
          <textarea id="incident-follow-up-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Catat tindak lanjut atau alasan faktual secara ringkas." style={{ display: "block", width: "100%", minHeight: 110, boxSizing: "border-box", border: "1px solid #aab8af", borderRadius: 8, padding: "10px 12px", font: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#68776e", fontSize: 12, marginTop: 4 }}><span>Minimal 10 karakter bila catatan diisi; wajib saat selesai/ditutup.</span><span>{note.length}/1000</span></div>
          {formError && <p role="alert" style={{ color: "#8c2b24", fontWeight: 650 }}>{formError}</p>}
          <button type="submit" disabled={saving} style={{ width: "100%", minHeight: 48, marginTop: 14, border: 0, borderRadius: 9, padding: "10px 14px", background: saving ? "#96a69b" : "#175b3c", color: "#fff", fontWeight: 750, fontSize: 16 }}>{saving ? "Menyimpan…" : "Simpan tindak lanjut"}</button>
        </form>
        <button type="button" onClick={refresh} disabled={refreshing} style={{ minHeight: 44, marginTop: 12, padding: "0 12px" }}>{refreshing ? "Memuat…" : "Muat ulang riwayat"}</button>
      </>}
    </main>
  );
}
