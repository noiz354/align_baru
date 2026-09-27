"use client";

import { useState } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";

export default function StockPage() {
  const [items, setItems] = useState([
    { stockItemId: "00000000-0000-7000-0000-000000000201", name: "Siomay Ayam", counted: 0 },
    { stockItemId: "00000000-0000-7000-0000-000000000202", name: "Batagor", counted: 0 },
    { stockItemId: "00000000-0000-7000-0000-000000000203", name: "Kulit Pangsit", counted: 0 },
  ]);
  const [status, setStatus] = useState("");

  const updateCount = (id: string, delta: number) => {
    setItems(prev => prev.map(it => it.stockItemId === id ? { ...it, counted: Math.max(0, it.counted + delta) } : it));
  };

  const handleSubmit = async () => {
    setStatus("Mengirim...");
    try {
      const clientReportId = crypto.randomUUID();
      const res = await fetch("/api/v1/stock-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientReportId },
        body: JSON.stringify({
          shiftId: "00000000-0000-7000-0000-000000000001",
          kind: "CLOSING_COUNT",
          items: items.map(i => ({ stockItemId: i.stockItemId, quantity: i.counted })),
          clientReportId,
        }),
      });
      const data = await res.json();
      if (res.ok) setStatus(`Berhasil simpan stok: ${data.snapshotIds?.length || 0} item`);
      else setStatus(`Gagal: ${data.error?.message}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Stok</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        {items.map(item => (
          <div key={item.stockItemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => updateCount(item.stockItemId, -1)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb" }}>-</button>
              <span style={{ minWidth: 30, textAlign: "center", fontWeight: 600 }}>{item.counted}</span>
              <button onClick={() => updateCount(item.stockItemId, 1)} style={{ width: 36, height: 36, borderRadius: 8, background: "#0f766e", color: "#fff", border: "none" }}>+</button>
            </div>
          </div>
        ))}

        {status && (
          <div style={{ padding: 12, background: status.startsWith("Berhasil") ? "#d1fae5" : "#fee2e2", borderRadius: 8, fontSize: 14 }}>
            {status}
          </div>
        )}

        <TapTarget minSize={72} label="Simpan Hitungan Stok" onClick={handleSubmit}>
          Simpan Hitungan Stok
        </TapTarget>

        <button
          onClick={() => (window.location.href = "/closing")}
          style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
        >
          Lanjut ke Tutup Shift →
        </button>
      </section>
    </main>
  );
}
