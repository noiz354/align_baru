"use client";

import { useCallback, useEffect, useState } from "react";

type GroundCondition = "DRY" | "WET";
type ShelterStatus = "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
type Cue = "INSUFFICIENT_DATA" | "REVIEW_SHELTER" | "WET_GROUND_CAUTION" | "NO_RELOCATION_CUE";
interface Observation {
  observedAt: string;
  groundCondition: GroundCondition;
  shelterStatus: ShelterStatus;
  shelterNote: string | null;
  relocationDecisionNote: string | null;
}
interface PageData {
  generatedAt: string;
  environment: "DEVELOPMENT" | "PRODUCTION";
  activeShift: null | { businessDay: string; startedAt: string; stallCode: string };
  currentLocation: null | { name: string; status: string };
  weather: { status: "UNAVAILABLE"; source: null; reason: "PROVIDER_NOT_CONFIGURED"; observedAt: null; temperatureCelsius: null; precipitationMillimeters: null };
  recentTraffic: { status: "NO_CURRENT_LOCATION" | "FEATURE_DISABLED" | "EMPTY" | "AVAILABLE"; samples: Array<{ sampledAt: string; estimatedCount: number; trafficBand: string }> };
  recentSales: { status: "NO_CURRENT_LOCATION" | "NO_ACTIVE_SHIFT" | "EMPTY" | "AVAILABLE"; sourceScope: "ACTIVE_SHIFT_AND_LOCATION"; records: Array<{ occurredAt: string; totalMinor: number; currency: "IDR"; status: string }>; truncated: boolean };
  observations: Observation[];
  assessment: { cue: Cue; reason: string; observationFresh: boolean; source: "OPERATOR_OBSERVATION_ONLY"; weatherIntegrated: false };
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #d9e2dd", borderRadius: 16, padding: 18, marginTop: 14 };
const action: React.CSSProperties = { minHeight: 48, border: 0, borderRadius: 10, padding: "12px 16px", fontSize: 16, fontWeight: 750, cursor: "pointer" };
const labels = {
  ground: { DRY: "Kering", WET: "Basah" },
  shelter: { AVAILABLE: "Tersedia", NOT_AVAILABLE: "Tidak tersedia", UNKNOWN: "Belum diketahui" },
  cue: {
    INSUFFICIENT_DATA: "Belum cukup data pengamatan baru",
    REVIEW_SHELTER: "Tinjau opsi lokasi yang terlindung",
    WET_GROUND_CAUTION: "Waspadai kondisi tanah basah",
    NO_RELOCATION_CUE: "Tidak ada isyarat pindah dari pengamatan ini",
  } satisfies Record<Cue, string>,
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
function responseMessage(response: Response, body: any): string {
  if (response.status === 401) return "Sesi berakhir. Masuk kembali untuk melanjutkan.";
  if (response.status === 403) return "Akun ini tidak memiliki akses ke kondisi lokasi operator.";
  if (response.status === 404) return "Shift atau lokasi tidak lagi tersedia. Muat ulang halaman.";
  if (response.status === 409) return "Permintaan sebelumnya berbeda atau sedang diselaraskan. Muat ulang halaman.";
  if (response.status === 412) return "Pengamatan hanya dapat disimpan saat shift dan titik jual aktif.";
  if (response.status === 400) return "Periksa pilihan kondisi dan catatan (maksimum 240/300 karakter).";
  return body?.error?.message || "Data belum dapat dimuat atau disimpan. Coba lagi.";
}

export default function OperatorSiteConditionClient() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [groundCondition, setGroundCondition] = useState<GroundCondition | "">("");
  const [shelterStatus, setShelterStatus] = useState<ShelterStatus | "">("");
  const [shelterNote, setShelterNote] = useState("");
  const [relocationDecisionNote, setRelocationDecisionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (initial = false) => {
    setPageError("");
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch("/api/v1/operators/me/site-condition", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(response, body));
      setData(body as PageData);
    } finally {
      if (!initial) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(true)
      .catch((error) => { if (active) setPageError(error instanceof Error ? error.message : "Halaman belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");
    setNotice("");
    if (!groundCondition || !shelterStatus) {
      setSaveError("Pilih kondisi tanah dan ketersediaan tempat berteduh.");
      return;
    }
    setSaving(true);
    const clientRequestId = crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/operators/me/site-condition", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientRequestId },
        body: JSON.stringify({
          clientRequestId,
          groundCondition,
          shelterStatus,
          ...(shelterNote.trim() ? { shelterNote: shelterNote.trim() } : {}),
          ...(relocationDecisionNote.trim() ? { relocationDecisionNote: relocationDecisionNote.trim() } : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(response, body));
      setNotice("Pengamatan tersimpan.");
      setGroundCondition("");
      setShelterStatus("");
      setShelterNote("");
      setRelocationDecisionNote("");
      try { await load(); }
      catch (error) { setPageError(`Pengamatan tersimpan, tetapi data terbaru belum dimuat. ${error instanceof Error ? error.message : "Muat ulang halaman."}`); }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Pengamatan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    try { await load(); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Data belum dapat dimuat."); }
    finally { setRefreshing(false); }
  };

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px 48px", color: "#14251c", fontFamily: "system-ui, sans-serif" }}>
      <a href="/operator" style={{ color: "#236a49", fontWeight: 700 }}>← Beranda operator</a>
      <header style={{ marginTop: 14 }}>
        <p style={{ margin: 0, color: "#54705f", fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 12 }}>Kondisi lokasi</p>
        <h1 style={{ margin: "5px 0 4px", fontSize: 30 }}>Cuaca & Kesesuaian Lokasi</h1>
        <p style={{ color: "#53675b", margin: 0 }}>Catat kondisi yang Anda amati. Indikator hanya membantu pertimbangan—keputusan tetap pada operator.</p>
      </header>

      {data?.environment === "DEVELOPMENT" && <div role="status" style={{ ...card, background: "#fff8dc", borderColor: "#ead48e" }}>Data shift dan lokasi berasal dari fixture pengembangan, bukan kondisi operasional nyata.</div>}
      {loading && <section role="status" style={card}>Memuat kondisi shift dan lokasi…</section>}
      {!loading && pageError && <section role="alert" style={{ ...card, borderColor: "#d99090", color: "#8d2626" }}>{pageError}<button onClick={refresh} disabled={refreshing} style={{ ...action, marginLeft: 12, background: "#e9f2ed", color: "#173d2a" }}>{refreshing ? "Memuat…" : "Coba lagi"}</button></section>}

      {!loading && data && !pageError && <>
        <section style={card} aria-label="Konteks shift">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Lokasi saat ini</h2>
          {data.activeShift && data.currentLocation ? <>
            <p style={{ margin: "4px 0" }}><strong>{data.currentLocation.name}</strong> · {data.currentLocation.status}</p>
            <p style={{ margin: 0, color: "#53675b" }}>Shift {data.activeShift.stallCode} · hari usaha {data.activeShift.businessDay}</p>
          </> : <p style={{ marginBottom: 0 }}>Tidak ada shift aktif atau titik jual yang dapat digunakan. Pengamatan belum bisa disimpan.</p>}
        </section>

        <section style={{ ...card, borderColor: "#e7cd87", background: "#fffaf0" }} aria-label="Sumber cuaca">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Data cuaca</h2>
          <p style={{ margin: "4px 0 0" }}><strong>Belum tersedia.</strong> Sumber cuaca belum terhubung; tidak ada prakiraan, suhu, atau curah hujan yang ditampilkan.</p>
        </section>

        <section style={card} aria-label="Isyarat kondisi teramati">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Isyarat dari pengamatan operator</h2>
          <p style={{ margin: "4px 0" }}><strong>{labels.cue[data.assessment.cue]}</strong></p>
          <p style={{ margin: 0, color: "#53675b" }}>Berdasarkan catatan tanah dan shelter terbaru; bukan prakiraan cuaca, skor keselamatan, atau perintah pindah. Data cuaca belum terintegrasi.</p>
        </section>

        <section style={card} aria-label="Aktivitas pendukung">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Sinyal operasional pendukung</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
            <div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>Sampel lalu lintas manual</h3>
              {data.recentTraffic.status === "FEATURE_DISABLED" ? <p>Pengambilan sampel lalu lintas sedang dinonaktifkan.</p>
                : data.recentTraffic.status === "NO_CURRENT_LOCATION" ? <p>Titik jual aktif tidak tersedia untuk mencocokkan sampel.</p>
                : data.recentTraffic.samples.length ? data.recentTraffic.samples.slice(0, 3).map((sample, index) => <p key={`${sample.sampledAt}-${index}`} style={{ margin: "5px 0" }}>{sample.trafficBand} · {sample.estimatedCount} orang · {formatDate(sample.sampledAt)}</p>)
                : <p>Belum ada sampel manual di titik ini.</p>}
              <p style={{ color: "#53675b", fontSize: 13 }}>Bukan data cuaca dan tidak dipakai untuk cue kondisi.</p>
            </div>
            <div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>Penjualan titik ini pada shift aktif</h3>
              {!data.activeShift ? <p>Tidak ada shift aktif untuk mencocokkan transaksi.</p>
                : !data.currentLocation ? <p>Titik jual aktif tidak tersedia untuk mencocokkan transaksi.</p>
                : !data.recentSales.records.length ? <p>Belum ada transaksi tersimpan untuk titik ini pada shift aktif.</p>
                : data.recentSales.records.slice(0, 3).map((sale, index) => <p key={`${sale.occurredAt}-${index}`} style={{ margin: "5px 0" }}>{formatRupiah(sale.totalMinor)} · {sale.status} · {formatDate(sale.occurredAt)}</p>)}
              <p style={{ color: "#53675b", fontSize: 13 }}>Maksimal tiga transaksi terbaru; pencarian memakai hingga 100 transaksi harian terbaru. Filter menggunakan shift dan titik jual yang tercatat saat transaksi; data ini tidak digunakan untuk cue kondisi.</p>
            </div>
          </div>
        </section>

        <section style={card} aria-label="Catat pengamatan lokasi">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Catat kondisi yang terlihat</h2>
          <p style={{ color: "#53675b", marginTop: 0 }}>Catatan dibatasi untuk informasi kondisi lokasi. Jangan masukkan nama, nomor telepon, atau data pribadi.</p>
          <form onSubmit={save}>
            <fieldset disabled={!data.activeShift || !data.currentLocation || saving} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 750, marginBottom: 8 }}>Kondisi tanah</legend>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(["DRY", "WET"] as const).map((value) => <label key={value} style={{ ...card, margin: 0, padding: 11, display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="groundCondition" value={value} checked={groundCondition === value} onChange={() => setGroundCondition(value)} /> {labels.ground[value]}
                </label>)}
              </div>
              <label style={{ display: "block", marginTop: 16, fontWeight: 750 }} htmlFor="shelterStatus">Tempat berteduh</label>
              <select id="shelterStatus" value={shelterStatus} onChange={(event) => setShelterStatus(event.target.value as ShelterStatus | "")} style={{ width: "100%", maxWidth: 440, minHeight: 48, border: "1px solid #a9b9ae", borderRadius: 9, padding: 10, marginTop: 6, fontSize: 16 }}>
                <option value="">Pilih kondisi</option>
                <option value="AVAILABLE">Tersedia</option>
                <option value="NOT_AVAILABLE">Tidak tersedia</option>
                <option value="UNKNOWN">Belum diketahui</option>
              </select>
              <label style={{ display: "block", marginTop: 14, fontWeight: 750 }} htmlFor="shelterNote">Catatan shelter (opsional)</label>
              <textarea id="shelterNote" value={shelterNote} maxLength={240} onChange={(event) => setShelterNote(event.target.value)} rows={2} placeholder="Contoh: sisi timur terlindung" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #a9b9ae", borderRadius: 9, padding: 10, marginTop: 6, font: "inherit" }} />
              <div style={{ textAlign: "right", color: "#62756a", fontSize: 12 }}>{shelterNote.length}/240</div>
              <label style={{ display: "block", marginTop: 14, fontWeight: 750 }} htmlFor="relocationDecisionNote">Catatan keputusan lokasi (opsional)</label>
              <textarea id="relocationDecisionNote" value={relocationDecisionNote} maxLength={300} onChange={(event) => setRelocationDecisionNote(event.target.value)} rows={2} placeholder="Catatan saja; tidak memindahkan shift atau titik jual" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #a9b9ae", borderRadius: 9, padding: 10, marginTop: 6, font: "inherit" }} />
              <div style={{ textAlign: "right", color: "#62756a", fontSize: 12 }}>{relocationDecisionNote.length}/300</div>
              <button type="submit" disabled={saving || !data.activeShift || !data.currentLocation} style={{ ...action, marginTop: 14, background: saving ? "#a9b9ae" : "#175b3c", color: "#fff" }}>{saving ? "Menyimpan…" : "Simpan pengamatan"}</button>
            </fieldset>
          </form>
          {saveError && <p role="alert" style={{ color: "#8d2626" }}>{saveError}</p>}
          {notice && <p role="status" style={{ color: "#17613e", fontWeight: 700 }}>{notice}</p>}
        </section>

        <section style={card} aria-label="Riwayat pengamatan lokasi">
          <h2 style={{ marginTop: 0, fontSize: 19 }}>Pengamatan terbaru di titik ini</h2>
          {!data.observations.length ? <p>Belum ada catatan kondisi di titik jual ini.</p> : <ol style={{ paddingLeft: 22, marginBottom: 0 }}>
            {data.observations.map((observation, index) => <li key={`${observation.observedAt}-${index}`} style={{ margin: "12px 0" }}>
              <strong>{labels.ground[observation.groundCondition]}</strong> · shelter {labels.shelter[observation.shelterStatus]} · {formatDate(observation.observedAt)}
              {observation.shelterNote && <p style={{ margin: "4px 0" }}>Shelter: {observation.shelterNote}</p>}
              {observation.relocationDecisionNote && <p style={{ margin: "4px 0" }}>Keputusan: {observation.relocationDecisionNote}</p>}
            </li>)}
          </ol>}
        </section>
      </>}
    </main>
  );
}
