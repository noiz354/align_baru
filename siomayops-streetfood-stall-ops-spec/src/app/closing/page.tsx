"use client";

import { useState } from "react";
import { MoneyText } from "@/shared/ui/MoneyText";
import { TapTarget } from "@/shared/ui/TapTarget";
import { money } from "@/shared/money/money";

export default function ClosingPage() {
  const [countedCash, setCountedCash] = useState(0);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");

  // MOCK ONLY — UI DEVELOPMENT DATA — NOT PRODUCTION DATA
  const expectedCash = money(250000, "IDR");

  const handleSubmit = async () => {
    setStatus("Mengirim...");
    try {
      const clientClosingId = crypto.randomUUID();
      const res = await fetch(`/api/v1/shifts/00000000-0000-7000-0000-000000000001/closing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientClosingId },
        body: JSON.stringify({
          countedCash: { amountMinor: countedCash, currency: "IDR" },
          varianceReason: reason || "UNKNOWN",
          varianceNote: reason,
          stockCounts: [],
          clientClosingId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Berhasil tutup shift: ${data.closingId}`);
      } else {
        setStatus(`Gagal: ${data.error?.message}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const varianceMinor = countedCash - expectedCash.amountMinor;
  const variance = money(varianceMinor, "IDR");

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Tutup Shift</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 16 }}>
        {/* MOCK ONLY — UI DEVELOPMENT DATA — NOT PRODUCTION DATA */}
        <div style={{ padding: 16, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Kas awal</span>
            <MoneyText value={money(50000, "IDR")} density="hq" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Penjualan tunai</span>
            <MoneyText value={money(300000, "IDR")} density="hq" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Pengeluaran tunai</span>
            <MoneyText value={money(-100000, "IDR")} density="hq" />
          </div>
          <div style={{ height: 1, background: "#e5e7eb" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span style={{ fontSize: 14 }}>Kas diharapkan</span>
            <MoneyText value={expectedCash} density="operator" />
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Hitung kas aktual</label>
          <input
            type="number"
            value={countedCash || ""}
            onChange={e => setCountedCash(Number(e.target.value))}
            placeholder="Masukkan jumlah kas di box"
            style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 18, fontWeight: 600 }}
          />
          {countedCash > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>Selisih</span>
              <MoneyText value={variance} density="hq" emphasis={varianceMinor === 0 ? "verified" : "waiting"} />
            </div>
          )}
        </div>

        {varianceMinor !== 0 && countedCash > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>Alasan selisih (wajib jika selisih)</label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={{ padding: "12px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <option value="">Pilih alasan</option>
              <option value="COUNTING_ERROR">Salah hitung</option>
              <option value="UNKNOWN">Tidak diketahui (UNKNOWN)</option>
              <option value="TRANSPORT">Biaya tak terduga</option>
              <option value="CUSTOMER_FLOW">Sepi/pembeli kurang</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>
        )}

        {status && (
          <div style={{ padding: 12, background: status.startsWith("Berhasil") ? "#d1fae5" : "#fee2e2", borderRadius: 8, fontSize: 14 }}>
            {status}
          </div>
        )}

        <TapTarget minSize={72} label="Kirim Tutup Shift" onClick={handleSubmit}>
          Kirim Tutup Shift
        </TapTarget>
      </section>
    </main>
  );
}
