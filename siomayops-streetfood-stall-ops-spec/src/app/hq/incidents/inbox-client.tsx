"use client";

import { useEffect, useState } from "react";

interface InboxItem {
  id: string;
  categoryCode: string;
  categoryLabel: string | null;
  status: string;
  severityHint: "P1" | "P2" | "P3" | null;
  occurredAt: string;
  reportedAt: string;
  reporterName: string | null;
  stallCode: string | null;
  locationName: string | null;
}
interface InboxData { generatedAt: string; items: InboxItem[] }
const statusLabel: Record<string, string> = {
  SUBMITTED: "Terkirim untuk ditinjau", ACKNOWLEDGED: "Diterima", INVESTIGATING: "Sedang ditinjau",
  ESCALATED: "Diteruskan untuk tindak lanjut", RESOLVED: "Ditandai selesai", CLOSED: "Ditutup",
};
function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function IncidentInboxClient() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const incidentId = new URLSearchParams(window.location.search).get("incidentId");
    if (incidentId) {
      window.location.replace(`/hq/incidents/${encodeURIComponent(incidentId)}`);
      return;
    }
    let active = true;
    void fetch("/api/v1/hq/incidents/inbox", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(response.status === 401 ? "Sesi berakhir. Masuk kembali." : response.status === 403 ? "Akun ini tidak memiliki akses ke laporan insiden." : "Inbox belum dapat dimuat.");
        return body as InboxData;
      })
      .then((body) => { if (active) setData(body); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Inbox belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/hq" style={{ color: "#286447", fontWeight: 700 }}>← Dashboard HQ</a>
      <header style={{ marginTop: 14 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Tindak lanjut operasional</p>
        <h1 style={{ margin: "5px 0", fontSize: 28 }}>Laporan insiden</h1>
        <p style={{ color: "#59685f", margin: 0 }}>Laporan mencatat keterangan pelapor, bukan penetapan kesalahan. Tinjau fakta secara manusiawi dan sesuai cakupan tugas Anda.</p>
      </header>
      {loading && <p role="status" style={{ marginTop: 18 }}>Memuat laporan…</p>}
      {error && <p role="alert" style={{ marginTop: 18, color: "#8c2b24" }}>{error}<button type="button" onClick={() => window.location.reload()} style={{ display: "block", minHeight: 44, marginTop: 8, padding: "0 12px" }}>Coba lagi</button></p>}
      {!loading && !error && data && data.items.length === 0 && <section style={{ marginTop: 18, padding: 18, border: "1px solid #dfe5e0", borderRadius: 12, background: "#fff" }}>Belum ada laporan dalam cakupan akun ini.</section>}
      {!loading && !error && data && data.items.length > 0 && <section aria-label="Laporan insiden dalam cakupan" style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {data.items.map((item) => <article key={item.id} style={{ border: "1px solid #dfe5e0", borderRadius: 12, background: "#fff", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><h2 style={{ fontSize: 17, margin: 0 }}>{item.categoryLabel ?? "Kategori tidak dikenal"}</h2><p style={{ color: "#58675f", margin: "5px 0 0" }}>{item.reporterName ?? "Operator"}{item.stallCode ? ` · ${item.stallCode}` : ""}{item.locationName ? ` · ${item.locationName}` : " · Tanpa tautan lokasi"}</p></div>
            <span style={{ borderRadius: 999, background: "#edf4ef", color: "#315d43", padding: "5px 10px", fontSize: 13, fontWeight: 700 }}>{statusLabel[item.status] ?? item.status}</span>
          </div>
          <p style={{ color: "#59685f", fontSize: 13, margin: "10px 0 12px" }}>Kejadian: {formatDate(item.occurredAt)} · Dilaporkan: {formatDate(item.reportedAt)}{item.severityHint ? ` · Urgensi menurut pelapor: ${item.severityHint}` : ""}</p>
          <a href={`/hq/incidents/${encodeURIComponent(item.id)}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 14px", borderRadius: 8, background: "#175b3c", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Tinjau laporan</a>
        </article>)}
      </section>}
      <p style={{ marginTop: 18, color: "#68776e", fontSize: 12 }}>Daftar dibatasi pada 100 laporan terbaru dalam cakupan akses Anda. Bukti media belum tersedia untuk ditinjau.</p>
    </main>
  );
}
