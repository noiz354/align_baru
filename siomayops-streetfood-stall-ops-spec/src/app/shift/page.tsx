"use client";

import { useState } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";

export default function ShiftPage() {
  const [status, setStatus] = useState<"idle" | "starting" | "open" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleStartShift = async () => {
    setStatus("starting");
    try {
      const clientShiftId = crypto.randomUUID();
      const res = await fetch("/api/v1/shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientShiftId,
        },
        body: JSON.stringify({
          operatorId: "00000000-0000-7000-0000-000000000010",
          stallId: "00000000-0000-7000-0000-000000000020",
          sellingLocationId: "00000000-0000-7000-0000-000000000030",
          openingCash: { amountMinor: 50000, currency: "IDR" },
          startingStock: [],
          clientShiftId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("open");
        setMessage(`Shift ${data.shiftId} dimulai - Hari ${data.businessDay}`);
      } else {
        setStatus("error");
        setMessage(data.error?.message || "Gagal memulai shift");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      <OfflineBanner isOffline={!navigator.onLine} pendingRecordCount={0} />
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Mulai Shift</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 16 }}>
        <StatusBadge tone={status === "open" ? "ok" : status === "error" ? "blocked" : "neutral"} messageId={status === "open" ? "OPEN" : status === "starting" ? "Memulai..." : status === "error" ? "GAGAL" : "IDLE"} />

        {message && (
          <div style={{ padding: 12, background: status === "error" ? "#fee2e2" : "#d1fae5", borderRadius: 8, fontSize: 14 }}>
            {message}
          </div>
        )}

        <div style={{ padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Detail Shift</h3>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#374151" }}>
            <li>Gerobak: ST-001 (Siomay Keliling)</li>
            <li>Lokasi: Mangkal Alun-alun Bandung</li>
            <li>Kas awal: Rp 50.000</li>
            <li>Stok awal: Sesuai pengeluaran gudang</li>
          </ul>
        </div>

        <TapTarget minSize={72} label="Mulai Jualan Sekarang" disabled={status === "starting"} onClick={handleStartShift}>
          {status === "starting" ? "Memulai..." : "Mulai Jualan Sekarang"}
        </TapTarget>

        <div style={{ display: "grid", gap: 8 }}>
          <button
            onClick={() => (window.location.href = "/sell")}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 }}
          >
            Lapor Lokasi Mangkal
          </button>
          <button
            onClick={() => (window.location.href = "/stock")}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 }}
          >
            Konfirmasi Stok Awal
          </button>
        </div>
      </section>
    </main>
  );
}
