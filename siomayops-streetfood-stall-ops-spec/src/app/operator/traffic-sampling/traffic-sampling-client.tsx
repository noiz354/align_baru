/** PHASE 0 — Page 11 implementation remains production-gated pending privacy and purge evidence. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startSilentTrafficCapture, type TrafficCapture } from "./capture";

type TrafficBand = "QUIET" | "STEADY" | "BUSY" | "VERY_BUSY";
type TrafficVideoStatus = "NOT_PROVIDED" | "UPLOADED" | "DELETED";
interface TrafficSample {
  id: string;
  sampledAt: string;
  estimatedCount: number;
  trafficBand: TrafficBand;
  note: string | null;
  videoStatus: TrafficVideoStatus;
}
interface PageData {
  enabled: boolean;
  environment: "DEVELOPMENT" | "PRODUCTION";
  generatedAt: string;
  activeShift: null | { shiftId: string; businessDay: string; startedAt: string; stallCode: string };
  currentLocation: null | { sellingLocationId: string; name: string; status: string; hasOpenReport: boolean };
  history: TrafficSample[];
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18, marginTop: 14 };
const primaryButton: React.CSSProperties = { minHeight: 48, border: 0, borderRadius: 12, padding: "12px 18px", background: "#0f766e", color: "white", fontSize: 16, fontWeight: 750, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { ...primaryButton, background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1" };
const bandLabels: Record<TrafficBand, string> = { QUIET: "Lengang", STEADY: "Stabil", BUSY: "Ramai", VERY_BUSY: "Sangat ramai" };

const sendEvent = (event: "traffic_sample_started" | "traffic_analysis_failed", reason?: string) => {
  void fetch("/api/v1/operators/me/traffic-sampling/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...(reason ? { reason } : {}) }),
    keepalive: true,
  }).catch(() => undefined);
};

const errorText = (response: Response): string => {
  if (response.status === 401) return "Sesi berakhir. Masuk kembali untuk melanjutkan.";
  if (response.status === 403) return "Akun ini tidak memiliki akses operator untuk sampel.";
  if (response.status === 412) return "Mulai shift dan pastikan titik jual aktif sebelum mengirim sampel.";
  if (response.status === 413) return "Ukuran video terlalu besar. Batasnya 10 MB.";
  if (response.status === 503) return "Fitur sampling belum diaktifkan untuk lingkungan ini.";
  if (response.status === 400 || response.status === 422) return "Data sampel tidak valid. Periksa hitungan lalu coba lagi.";
  return "Sampel belum tersimpan. Periksa koneksi lalu coba lagi.";
};

const formatTime = (value: string): string => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const requestId = (): string => crypto.randomUUID();

export default function TrafficSamplingClient() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [capture, setCapture] = useState<TrafficCapture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [uploadRequestId, setUploadRequestId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"NONE" | "READY" | "UPLOADING" | "UPLOADED" | "FAILED">("NONE");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);

  const stopTracks = useCallback((active = capture) => {
    if (!active) return;
    active.stream.getTracks().forEach((track) => track.stop());
    setCapture(null);
    setCapturing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [capture]);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/v1/operators/me/traffic-sampling", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(response));
      setData(body as PageData);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Sampel lalu lintas belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (videoRef.current && videoUrl) videoRef.current.src = videoUrl;
  }, [videoUrl]);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    capture?.stream.getTracks().forEach((track) => track.stop());
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [capture, videoUrl]);

  const finishRecording = useCallback((active: TrafficCapture) => {
    if (active.recorder.state !== "inactive") active.recorder.stop();
    active.stream.getTracks().forEach((track) => track.stop());
    setCapture(null);
    setCapturing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const beginCapture = async () => {
    if (!data?.enabled || capture || capturing) return;
    setCaptureError("");
    setSavedMessage("");
    sendEvent("traffic_sample_started");
    let attemptedCapture: TrafficCapture | null = null;
    try {
      const active = await startSilentTrafficCapture();
      attemptedCapture = active;
      setCapture(active);
      setCapturing(true);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      if (videoRef.current) {
        videoRef.current.srcObject = active.stream;
        void videoRef.current.play().catch(() => undefined);
      }
      active.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      active.recorder.addEventListener("stop", () => {
        const elapsed = Math.min(10_000, Math.max(1, Date.now() - startedAtRef.current));
        setVideoDurationMs(elapsed);
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        if (blob.size) {
          setVideoBlob(blob);
          setUploadRequestId(requestId());
          setUploadStatus("READY");
          setVideoUrl(URL.createObjectURL(blob));
        } else {
          setCaptureError("Tidak ada video yang terekam. Hitungan manual tetap dapat disimpan.");
        }
        if (videoRef.current) videoRef.current.srcObject = null;
      }, { once: true });
      active.recorder.start(250);
      timerRef.current = setTimeout(() => finishRecording(active), 9_000);
    } catch (error: any) {
      if (attemptedCapture) {
        try { if (attemptedCapture.recorder.state !== "inactive") attemptedCapture.recorder.stop(); } catch {}
        attemptedCapture.stream.getTracks().forEach((track) => track.stop());
        setCapture(null);
        setCapturing(false);
      } else {
        stopTracks();
      }
      const reason = error?.code === "UNSUPPORTED" ? "unsupported" : error?.name === "NotAllowedError" ? "permission_denied" : "server";
      setCaptureError(reason === "permission_denied"
        ? "Izin kamera ditolak. Anda tetap dapat memasukkan hitungan tanpa video."
        : reason === "unsupported" ? "Perangkat ini tidak mendukung video WebM. Hitungan manual tetap tersedia."
          : "Kamera tidak dapat dimulai. Hitungan manual tetap tersedia.");
      sendEvent("traffic_analysis_failed", reason);
    }
  };

  const uploadVideo = async () => {
    if (!videoBlob || !data?.enabled || uploadStatus === "UPLOADING") return;
    setUploadStatus("UPLOADING");
    setSaveError("");
    try {
      const form = new FormData();
      form.append("video", videoBlob, "traffic-sample.webm");
      form.append("durationMs", String(videoDurationMs));
      const response = await fetch("/api/v1/operators/me/traffic-samples/uploads", { method: "POST", headers: { "Idempotency-Key": uploadRequestId }, body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(response));
      setUploadId(body.uploadId);
      setUploadStatus("UPLOADED");
      setVideoBlob(null);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
    } catch (error) {
      setUploadStatus("FAILED");
      setSaveError(error instanceof Error ? error.message : "Video belum terunggah.");
      sendEvent("traffic_analysis_failed", "network");
    }
  };

  const saveSample = async (event: React.FormEvent) => {
    event.preventDefault();
    const estimate = Number(count);
    if (!data?.enabled || !Number.isInteger(estimate) || estimate < 0 || estimate > 500) {
      setSaveError("Masukkan hitungan bulat dari 0 sampai 500.");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSavedMessage("");
    const createRequestId = requestId();
    try {
      const response = await fetch("/api/v1/operators/me/traffic-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": createRequestId },
        body: JSON.stringify({ clientRequestId: createRequestId, estimatedCount: estimate, ...(note.trim() ? { note: note.trim() } : {}), ...(uploadId ? { videoUploadId: uploadId } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(response));
      const sample = body.sample as TrafficSample;
      setCount("");
      setNote("");
      setVideoBlob(null);
      setUploadId("");
      setUploadRequestId("");
      setUploadStatus("NONE");
      setVideoDurationMs(0);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
      setSavedMessage(`Hitungan tersimpan sebagai ${bandLabels[sample.trafficBand]}.`);
      await load();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Hitungan belum tersimpan.");
      sendEvent("traffic_analysis_failed", "server");
    } finally {
      setSaving(false);
    }
  };

  const cancelVideo = () => {
    if (capture) finishRecording(capture);
    setVideoBlob(null);
    setUploadId("");
    setUploadRequestId("");
    setUploadStatus("NONE");
    setVideoDurationMs(0);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl("");
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const disabled = loading || saving || !data?.enabled;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 56px", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
      <a href="/operator" style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>← Kembali ke operator</a>
      <header style={{ marginTop: 18 }}>
        <p style={{ margin: 0, color: "#0f766e", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 12 }}>Operasional · Perkiraan anonim</p>
        <h1 style={{ margin: "7px 0", fontSize: 30, lineHeight: 1.15 }}>Sampel arus pengunjung</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>Hitung orang yang melintas secara manual. Video hanya opsional dan tidak menganalisis identitas.</p>
      </header>

      {loading && <section role="status" style={card}>Memuat lokasi dan sampel sebelumnya…</section>}
      {!loading && pageError && <section role="alert" style={{ ...card, borderColor: "#fca5a5", color: "#991b1b" }}><p>{pageError}</p><button style={secondaryButton} onClick={() => void load()}>Coba lagi</button></section>}

      {!loading && !pageError && data && <>
        {data.environment === "DEVELOPMENT" && <section role="status" style={{ ...card, background: "#f1f5f9", borderColor: "#94a3b8" }}><strong>Lingkungan pengembangan.</strong> Data outlet/shift berasal dari fixture lokal; jangan gunakan sebagai catatan operasional.</section>}
        <section style={card} aria-label="Konteks outlet">
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Konteks saat ini</h2>
          {data.activeShift && data.currentLocation ? <dl style={{ display: "grid", gridTemplateColumns: "minmax(100px, .7fr) 1fr", gap: "8px 14px", margin: 0 }}>
            <dt style={{ color: "#64748b" }}>Outlet</dt><dd style={{ margin: 0, fontWeight: 700 }}>{data.currentLocation.name}</dd>
            <dt style={{ color: "#64748b" }}>Shift</dt><dd style={{ margin: 0 }}>{data.activeShift.stallCode} · {formatTime(data.activeShift.startedAt)}</dd>
          </dl> : <p style={{ margin: 0, color: "#9a3412" }}>Shift aktif dan titik jual saat ini diperlukan. Hitungan belum dapat disimpan.</p>}
        </section>

        {!data.enabled && <section role="status" style={{ ...card, background: "#fffbeb", borderColor: "#fcd34d" }}><strong>Sampling video dinonaktifkan.</strong> Pengambilan dan penyimpanan sampel hanya dibuka setelah persetujuan privasi dan penghapusan media terverifikasi.</section>}

        <section style={card} aria-label="Privasi video">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Sebelum mulai</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.55 }}>
            <li>Video diam, maksimal 10 detik, hanya setelah tombol mulai ditekan. Mikrofon tidak digunakan.</li>
            <li>Bidik arus orang secara umum; hindari wajah, layar, plat nomor, dan detail pribadi. Batalkan bila tidak memungkinkan.</li>
            <li>Hitungan dimasukkan manual. Tidak ada pengenalan wajah/orang, analisis komputer, atau penggunaan untuk pelatihan.</li>
            <li>Video privat dihapus paling lambat 24 jam; HQ tidak dapat membuka klip. Hasil tidak ditautkan ke operator atau shift.</li>
            <li>Video opsional: Anda dapat membatalkan unggahan dan tetap mengirim hitungan manual.</li>
          </ul>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <video ref={videoRef} muted playsInline controls={Boolean(videoUrl)} style={{ width: "100%", maxHeight: 360, background: "#0f172a", borderRadius: 12, display: capture || videoUrl ? "block" : "none" }} aria-label="Pratinjau video arus pengunjung" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!capturing && uploadStatus === "NONE" && <button type="button" style={primaryButton} disabled={disabled || !data.activeShift || !data.currentLocation} onClick={() => void beginCapture()}>Mulai rekam 10 detik</button>}
              {capturing && capture && <button type="button" style={{ ...primaryButton, background: "#b91c1c" }} onClick={() => finishRecording(capture)}>Hentikan rekaman</button>}
              {uploadStatus === "READY" && <><button type="button" style={primaryButton} disabled={disabled} onClick={() => void uploadVideo()}>Unggah video privat</button><button type="button" style={secondaryButton} onClick={cancelVideo}>Batalkan video</button></>}
              {uploadStatus === "UPLOADING" && <button type="button" style={secondaryButton} disabled>Video sedang diunggah…</button>}
              {uploadStatus === "UPLOADED" && <button type="button" style={secondaryButton} onClick={cancelVideo}>Video terunggah · hapus dari formulir</button>}
              {uploadStatus === "FAILED" && <button type="button" style={primaryButton} onClick={() => setUploadStatus("READY")}>Coba unggah lagi</button>}
            </div>
            <p aria-live="polite" style={{ margin: 0, color: uploadStatus === "FAILED" ? "#b91c1c" : "#475569" }}>
              {capturing ? "Merekam tanpa audio. Rekaman berhenti otomatis dalam 10 detik." : uploadStatus === "READY" ? `Video siap (${(videoDurationMs / 1000).toFixed(1)} detik); belum diunggah.` : uploadStatus === "UPLOADING" ? "Mengirim ke penyimpanan privat…" : uploadStatus === "UPLOADED" ? "Status unggahan: tersimpan. Video akan dihapus dalam 24 jam." : "Tidak ada video yang direkam."}
            </p>
          </div>
          {captureError && <p role="status" style={{ color: "#9a3412" }}>{captureError}</p>}
        </section>

        <form onSubmit={saveSample} style={card}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Masukkan perkiraan</h2>
          <p style={{ margin: "0 0 14px", color: "#64748b" }}>Hitung orang yang melintas selama sampel. Band akan dihitung dari angka ini.</p>
          <label htmlFor="traffic-count" style={{ display: "block", fontWeight: 700 }}>Jumlah orang <span aria-hidden="true">*</span></label>
          <input id="traffic-count" type="number" inputMode="numeric" min="0" max="500" step="1" required value={count} onChange={(event) => setCount(event.target.value)} disabled={disabled || !data.activeShift || !data.currentLocation} style={{ marginTop: 6, width: "100%", boxSizing: "border-box", minHeight: 50, padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 18 }} />
          <label htmlFor="traffic-note" style={{ display: "block", fontWeight: 700, marginTop: 14 }}>Catatan kondisi (opsional)</label>
          <textarea id="traffic-note" maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} disabled={disabled} placeholder="Contoh: hujan ringan, antrean menutup sebagian jalur" style={{ marginTop: 6, width: "100%", minHeight: 82, boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", font: "inherit" }} />
          <small style={{ color: "#64748b" }}>Jangan tulis nama orang atau informasi pribadi. Maksimal 240 karakter.</small>
          {saveError && <p role="alert" style={{ color: "#b91c1c" }}>{saveError}</p>}
          {savedMessage && <p role="status" style={{ color: "#166534", fontWeight: 700 }}>{savedMessage}</p>}
          <button type="submit" style={{ ...primaryButton, width: "100%", marginTop: 14 }} disabled={disabled || capturing || uploadStatus === "UPLOADING" || !data.activeShift || !data.currentLocation || !count}>Simpan hitungan</button>
        </form>

        <section style={card} aria-label="Sampel sebelumnya">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Sampel sebelumnya</h2><button type="button" style={{ ...secondaryButton, minHeight: 38, padding: "7px 12px", fontSize: 14 }} onClick={() => void load()}>Muat ulang</button></div>
          {data.history.length === 0 ? <p style={{ color: "#64748b", marginBottom: 0 }}>Belum ada sampel tersimpan untuk titik jual ini.</p> : <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
            {data.history.map((sample) => <li key={sample.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{sample.estimatedCount} orang · {bandLabels[sample.trafficBand]}</strong><time dateTime={sample.sampledAt} style={{ color: "#64748b" }}>{formatTime(sample.sampledAt)}</time></div>
              {sample.note && <p style={{ margin: "5px 0", color: "#475569" }}>{sample.note}</p>}
              <small style={{ color: "#64748b" }}>Video: {sample.videoStatus === "UPLOADED" ? "tersimpan, terhapus maksimal 24 jam" : sample.videoStatus === "DELETED" ? "dihapus sesuai kebijakan" : "tidak disertakan"}</small>
            </li>)}
          </ol>}
        </section>
      </>}
    </main>
  );
}
