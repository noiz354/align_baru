"use client";

import { useState } from "react";

export default function VerificationPage() {
  const [status, setStatus] = useState("");

  const handleReconcile = async () => {
    setStatus("Memverifikasi...");
    try {
      const res = await fetch("/api/v1/webhooks/payments/fake", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": "fake-signature" },
        body: JSON.stringify({
          partnerReferenceNo: "sale-id-placeholder",
          providerReferenceId: "PROV-FAKE123",
          amountMinor: 15000,
          state: "PAID",
        }),
      });
      const data = await res.json();
      setStatus(`Hasil: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Verifikasi Pembayaran</h1>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Hanya pembayaran terverifikasi atau rekonsiliasi Finance yang mencapai PAID. Tidak ada jalur browser-side success.</p>

      <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Antrian PENDING_VERIFICATION</h3>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Payment ID</th>
              <th style={{ padding: 8 }}>Sale</th>
              <th style={{ padding: 8 }}>Jumlah</th>
              <th style={{ padding: 8 }}>Metode</th>
              <th style={{ padding: 8 }}>Umur</th>
              <th style={{ padding: 8 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 8 }}>PAY-001</td>
              <td style={{ padding: 8 }}>SALE-001</td>
              <td style={{ padding: 8 }}>Rp 15.000</td>
              <td style={{ padding: 8 }}>QRIS_STATIC</td>
              <td style={{ padding: 8 }}>2 jam</td>
              <td style={{ padding: 8 }}>
                <button onClick={handleReconcile} style={{ fontSize: 12, padding: "4px 8px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6 }}>
                  Verifikasi Manual
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        {status && <div style={{ marginTop: 12, padding: 8, background: "#f3f4f6", borderRadius: 6, fontSize: 12 }}>{status}</div>}
      </div>

      <a href="/hq" style={{ display: "inline-block", marginTop: 16, fontSize: 14, color: "#0f766e" }}>← Kembali ke Dashboard</a>
    </main>
  );
}
