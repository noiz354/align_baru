"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LocationCaptureError,
  readLocationPermission,
  requestOneShotPosition,
  type LocationPermissionState,
  type OneShotLocationFix,
} from "./geolocation";

type LocationStatus = "AVAILABLE" | "ACTIVE" | "CROWDED" | "TEMPORARILY_UNAVAILABLE" | "RESTRICTED" | "INACTIVE";
interface LocationChoice {
  sellingLocationId: string;
  name: string;
  status: LocationStatus;
}
interface LocationContext {
  generatedAt: string;
  gpsCaptureEnabled: boolean;
  activeShift: null | { shiftId: string; businessDay: string; startedAt: string; stallCode: string };
  currentLocation: null | { sellingLocationId: string; name: string; status: LocationStatus; hasOpenReport: boolean };
  gpsSample: null | { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string };
  locationChoices: LocationChoice[];
}

type MoveReason = "CROWDED" | "PERMISSION_ISSUE_REPORTED" | "WEATHER" | "COMPETITION" | "CUSTOMER_FLOW" | "EQUIPMENT" | "PERSONAL" | "OTHER";

const STATUS_LABEL: Record<LocationStatus, string> = {
  AVAILABLE: "Tersedia",
  ACTIVE: "Aktif",
  CROWDED: "Padat",
  TEMPORARILY_UNAVAILABLE: "Sementara tidak tersedia",
  RESTRICTED: "Perlu perhatian",
  INACTIVE: "Tidak aktif",
};
const REASONS: { value: MoveReason; label: string }[] = [
  { value: "CROWDED", label: "Lokasi terlalu padat" },
  { value: "PERMISSION_ISSUE_REPORTED", label: "Ada kendala izin yang dilaporkan" },
  { value: "WEATHER", label: "Cuaca" },
  { value: "COMPETITION", label: "Persaingan di sekitar lokasi" },
  { value: "CUSTOMER_FLOW", label: "Arus pelanggan berubah" },
  { value: "EQUIPMENT", label: "Kendala peralatan" },
  { value: "PERSONAL", label: "Alasan pribadi" },
  { value: "OTHER", label: "Alasan lainnya" },
];
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 18,
  marginTop: 14,
};
const buttonStyle: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 10,
  border: 0,
  padding: "12px 16px",
  fontWeight: 750,
  fontSize: 16,
  cursor: "pointer",
};

const sendEvent = (event: "location_capture_started" | "location_permission_denied" | "location_save_failed", reason?: string) => {
  void fetch("/api/v1/operators/me/location/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...(reason ? { reason } : {}) }),
    keepalive: true,
  }).catch(() => undefined);
};

function errorMessage(response: Response, body: any): string {
  const code = body?.error?.code;
  if (response.status === 401) return "Sesi Anda berakhir. Masuk kembali untuk melanjutkan.";
  if (response.status === 403) return "Laporan ini tidak dapat dikirim dari akun operator saat ini.";
  if (response.status === 404) return "Shift atau titik jual tidak lagi tersedia. Muat ulang halaman.";
  if (response.status === 409) return "Ada laporan yang perlu diselaraskan. Muat ulang sebelum mencoba lagi.";
  if (response.status === 412) return "Shift tidak lagi aktif atau titik jual sudah tidak dapat dipilih.";
  if (code === "VALIDATION_FAILED") return "Periksa kembali titik jual dan alasan perpindahan.";
  return "Laporan belum tersimpan. Periksa koneksi lalu coba lagi.";
}

function permissionLabel(state: LocationPermissionState): string {
  if (state === "granted") return "Izin lokasi diizinkan";
  if (state === "denied") return "Izin lokasi ditolak di perangkat";
  if (state === "prompt") return "Izin lokasi akan diminta saat Anda memilih Ambil posisi sekali";
  return "Status izin lokasi belum dapat dibaca";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OperatorLocationPage() {
  const [context, setContext] = useState<LocationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [moveReason, setMoveReason] = useState<MoveReason>("OTHER");
  const [sample, setSample] = useState<OneShotLocationFix | null>(null);
  const [sampleConfirmed, setSampleConfirmed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadContext = useCallback(async () => {
    setPageError("");
    const response = await fetch("/api/v1/operators/me/location", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(response, body));
    const next = body as LocationContext;
    setContext(next);
    setSelectedLocationId(next.currentLocation?.sellingLocationId || next.locationChoices[0]?.sellingLocationId || "");
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void loadContext()
      .then(async (next) => {
        if (active && next.gpsCaptureEnabled) setPermission(await readLocationPermission());
      })
      .catch((error) => { if (active) setPageError(error instanceof Error ? error.message : "Halaman lokasi tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadContext]);

  const currentChoice = context?.locationChoices.find((choice) => choice.sellingLocationId === selectedLocationId);
  const isCurrentLocation = Boolean(context?.currentLocation && context.currentLocation.sellingLocationId === selectedLocationId);
  const isMoving = Boolean(selectedLocationId && context?.currentLocation && !isCurrentLocation);

  const capturePosition = async () => {
    setCapturing(true);
    setNotice("");
    sendEvent("location_capture_started");
    try {
      const fix = await requestOneShotPosition();
      setSample(fix);
      setSampleConfirmed(false);
      setPermission(await readLocationPermission());
      setNotice("Posisi dibaca satu kali. Periksa titik jual dan pilih apakah sampel ini akan dilampirkan ke laporan.");
    } catch (error) {
      setSample(null);
      const reason = error instanceof LocationCaptureError ? error.reason : "unavailable";
      if (reason === "denied") {
        setPermission("denied");
        sendEvent("location_permission_denied", "denied");
        setNotice("Izin lokasi ditolak. Anda tetap dapat memilih dan melaporkan titik jual secara manual.");
      } else if (reason === "unsupported") {
        setNotice("Perangkat atau browser ini tidak menyediakan lokasi. Anda tetap dapat melanjutkan secara manual.");
      } else if (reason === "timeout") {
        setNotice("Perangkat belum mendapat posisi tepat waktu. Coba lagi atau lanjutkan secara manual.");
      } else {
        setNotice("Posisi tidak tersedia. Anda tetap dapat melaporkan titik jual secara manual.");
      }
    } finally {
      setCapturing(false);
    }
  };

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!context?.activeShift || !selectedLocationId || saving) return;
    if (sample && !sampleConfirmed) {
      setNotice("Konfirmasi terlebih dahulu jika Anda ingin melampirkan sampel GPS ini.");
      return;
    }
    setSaving(true);
    setNotice("");
    const trigger = isMoving ? "MOVE_SITE" : isCurrentLocation && context.currentLocation?.hasOpenReport ? "CONFIRM_UNCHANGED" : "ARRIVED";
    const clientReportId = crypto.randomUUID();
    const payload = {
      sellingLocationId: selectedLocationId,
      trigger,
      ...(trigger === "MOVE_SITE" ? { reasonForMove: moveReason } : {}),
      clientReportId,
      ...(sample && sampleConfirmed ? { gpsSample: sample } : {}),
    };

    try {
      const response = await fetch(`/api/v1/shifts/${context.activeShift.shiftId}/location-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientReportId,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(errorMessage(response, body));
        return;
      }
      setNotice(body?.gpsSampleStored
        ? "Titik jual dan sampel posisi berhasil disimpan. Sampel GPS akan dihapus paling lambat dalam 14 hari."
        : "Titik jual berhasil disimpan. Tidak ada sampel GPS baru yang dilampirkan.");
      setSample(null);
      setSampleConfirmed(false);
      try {
        await loadContext();
      } catch {
        // The successful write remains confirmed; the operator can refresh to reload current context.
      }
    } catch {
      sendEvent("location_save_failed", "network");
      setNotice("Koneksi terputus. Laporan belum tersimpan; sampel tetap hanya berada di memori halaman ini. Coba lagi atau lanjutkan tanpa sampel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh", background: "#f8fafc", padding: "22px 16px 40px", color: "#172033", fontFamily: "system-ui, sans-serif" }}>
      <header>
        <a href="/operator" style={{ color: "#155e75", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>← Beranda operator</a>
        <p style={{ margin: "20px 0 4px", color: "#0e7490", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, fontWeight: 800 }}>Laporan shift</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>Perbarui lokasi jual</h1>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>Pilih titik jual untuk shift aktif. GPS bersifat opsional dan hanya dibaca setelah Anda menekan tombol.</p>
      </header>

      <section style={{ ...cardStyle, background: "#ecfeff", borderColor: "#a5f3fc" }} aria-label="Pemberitahuan privasi lokasi">
        <strong style={{ display: "block", marginBottom: 6 }}>Privasi dan penggunaan lokasi</strong>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#334155" }}>
          Satu sampel GPS hanya dilampirkan jika Anda memilihnya saat mengirim laporan. Sampel disimpan maksimal 14 hari; beberapa laporan eksplisit dapat membentuk rangkaian titik terbatas selama shift. Tidak ada pelacakan latar belakang. Posisi adalah perkiraan, bukan bukti presensi atau penilaian kinerja.
        </p>
      </section>

      {loading ? <p role="status" style={{ marginTop: 22 }}>Memuat shift dan titik jual…</p> : null}
      {pageError ? <div role="alert" style={{ ...cardStyle, borderColor: "#fecaca", color: "#991b1b" }}>{pageError}</div> : null}

      {!loading && !pageError && context ? <>
        <section style={cardStyle} aria-label="Konteks shift aktif">
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Shift aktif</h2>
          {context.activeShift ? <div style={{ display: "grid", gap: 5, fontSize: 14 }}>
            <div><strong>Gerai:</strong> {context.activeShift.stallCode}</div>
            <div><strong>Tanggal operasional:</strong> {context.activeShift.businessDay}</div>
            <div><strong>Lokasi saat ini:</strong> {context.currentLocation ? `${context.currentLocation.name} · ${STATUS_LABEL[context.currentLocation.status]}` : "Belum ada laporan lokasi"}</div>
          </div> : <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>Tidak ada shift aktif untuk akun ini. Mulai atau buka shift terlebih dahulu; halaman ini tidak menerima lokasi di luar shift.</p>}
        </section>

        {context.activeShift ? <form onSubmit={submitReport}>
          <section style={cardStyle}>
            <label htmlFor="selling-location" style={{ display: "block", fontWeight: 750, marginBottom: 8 }}>Titik jual</label>
            <select
              id="selling-location"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              required
              disabled={saving || context.locationChoices.length === 0}
              style={{ width: "100%", minHeight: 48, borderRadius: 9, border: "1px solid #cbd5e1", padding: "10px 12px", fontSize: 16, background: "white" }}
            >
              <option value="" disabled>Pilih titik jual</option>
              {context.locationChoices.map((choice) => <option key={choice.sellingLocationId} value={choice.sellingLocationId}>
                {choice.name} — {STATUS_LABEL[choice.status]}
              </option>)}
            </select>
            {context.locationChoices.length === 0 ? <p style={{ color: "#9a3412", fontSize: 14 }}>Belum ada titik jual aktif yang terdaftar untuk area gerai ini.</p> : null}

            {isMoving ? <div style={{ marginTop: 16 }}>
              <label htmlFor="move-reason" style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Alasan perpindahan</label>
              <select id="move-reason" value={moveReason} onChange={(event) => setMoveReason(event.target.value as MoveReason)} style={{ width: "100%", minHeight: 48, borderRadius: 9, border: "1px solid #cbd5e1", padding: "10px 12px", fontSize: 16, background: "white" }}>
                {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </div> : null}
          </section>

          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Bantuan GPS (opsional)</h2>
            <p style={{ margin: "0 0 10px", color: "#475569", fontSize: 14 }}>{permissionLabel(permission)}</p>
            {!context.gpsCaptureEnabled ? <p style={{ margin: "0 0 10px", color: "#9a3412", fontSize: 14 }}>Bantuan GPS dinonaktifkan sampai persetujuan privasi dan retensi produksi tersedia. Pelaporan titik jual manual tetap dapat digunakan.</p> : null}
            <button type="button" onClick={capturePosition} disabled={capturing || saving || !context.gpsCaptureEnabled} style={{ ...buttonStyle, width: "100%", background: "#cffafe", color: "#164e63", border: "1px solid #67e8f9", opacity: !context.gpsCaptureEnabled ? 0.55 : 1 }}>
              {capturing ? "Membaca posisi sekali…" : context.gpsCaptureEnabled ? "Ambil posisi sekali" : "Bantuan GPS belum diaktifkan"}
            </button>
            {sample ? <div style={{ marginTop: 14, borderRadius: 10, background: "#f0fdfa", border: "1px solid #99f6e4", padding: 12 }}>
              <strong style={{ display: "block" }}>Sampel perangkat — periksa sebelum mengirim</strong>
              <div style={{ marginTop: 7, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                {sample.latitude.toFixed(6)}, {sample.longitude.toFixed(6)}
              </div>
              <div style={{ marginTop: 4, color: "#475569", fontSize: 13 }}>Akurasi perangkat ±{Math.round(sample.accuracyMeters)} m · dibaca {formatTime(sample.capturedAt)}</div>
              {sample.accuracyMeters > 100 ? <p style={{ margin: "8px 0 0", color: "#9a3412", fontSize: 13 }}>Akurasi cukup lebar. Anda boleh mengambil ulang, memilih titik jual secara manual, atau tidak melampirkan sampel.</p> : null}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, fontSize: 14, lineHeight: 1.45 }}>
                <input type="checkbox" checked={sampleConfirmed} onChange={(event) => setSampleConfirmed(event.target.checked)} style={{ width: 20, height: 20, flex: "0 0 20px", marginTop: 1 }} />
                <span>Saya memilih melampirkan sampel perkiraan ini ke laporan shift yang sedang saya kirim.</span>
              </label>
            </div> : null}
            <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>Jika izin ditolak atau perangkat tidak mendukung lokasi, Anda tetap dapat mengirim laporan titik jual secara manual.</p>
          </section>

          {notice ? <p role="status" aria-live="polite" style={{ ...cardStyle, marginTop: 14, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534", lineHeight: 1.5 }}>{notice}</p> : null}

          <button type="submit" disabled={saving || !selectedLocationId || context.locationChoices.length === 0 || (Boolean(sample) && !sampleConfirmed)} style={{ ...buttonStyle, width: "100%", marginTop: 16, background: "#0e7490", color: "white", opacity: saving || !selectedLocationId || context.locationChoices.length === 0 || (Boolean(sample) && !sampleConfirmed) ? 0.55 : 1 }}>
            {saving ? "Menyimpan laporan…" : "Simpan laporan lokasi"}
          </button>
          <p style={{ margin: "10px 6px 0", textAlign: "center", color: "#64748b", fontSize: 12 }}>Laporan dikaitkan ke shift aktif dan operator diambil dari sesi, bukan dari isian perangkat.</p>
        </form> : null}

        {context.gpsSample ? <section style={cardStyle} aria-label="Sampel GPS tersimpan">
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Sampel pada laporan lokasi aktif</h2>
          <p style={{ margin: 0, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{context.gpsSample.latitude.toFixed(6)}, {context.gpsSample.longitude.toFixed(6)}</p>
          <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Akurasi ±{Math.round(context.gpsSample.accuracyMeters)} m · {formatTime(context.gpsSample.capturedAt)}</p>
        </section> : null}
      </> : null}
    </main>
  );
}
