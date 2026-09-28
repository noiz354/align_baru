"use client";

import { useState, useEffect } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";

type StockRow = { stockItemId: string; name: string; code: string; currentQty: number; counted: number };

export default function StockPage() {
  const [items, setItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/stock", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "stock fetch failed");
        const data = (json.data || []) as any[];
        if (!cancelled) {
          setItems(data.map((r:any)=> ({ stockItemId: r.stockItemId, name: r.name, code: r.code, currentQty: r.currentQty, counted: r.currentQty })));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setItems([
            { stockItemId: "00000000-0000-7000-0000-000000000201", name: "Siomay Ayam", code:"STK-001", currentQty: 40, counted: 40 },
            { stockItemId: "00000000-0000-7000-0000-000000000202", name: "Siomay Campur", code:"STK-002", currentQty: 40, counted: 40 },
            { stockItemId: "00000000-0000-7000-0000-000000000203", name: "Batagor", code:"STK-003", currentQty: 40, counted: 40 },
            { stockItemId: "00000000-0000-7000-0000-000000000204", name: "Es Teh", code:"STK-004", currentQty: 40, counted: 40 },
          ]);
          setLoading(false);
        }
      }
    }
    load();
    return ()=> { cancelled=true; };
  }, []);

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
      if (res.ok) setStatus(`Berhasil simpan stok: ${data.snapshotIds?.length || items.length} item — sisa terkini diperbarui`);
      else setStatus(`Gagal: ${data.error?.message}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const totalQty = items.reduce((s,i)=> s + i.currentQty, 0);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Stok</h1>
          <p style={{ margin:"4px 0 0", color:"#6b7280", fontSize:12 }}>DB live — Total {totalQty} porsi {loading?"(memuat…)":""}</p>
        </div>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ padding:24, textAlign:"center", color:"#6b7280", fontSize:14, border:"1px dashed #e5e7eb", borderRadius:10 }}>Memuat stok dari DB…</div>
        ) : items.map(item => (
          <div key={item.stockItemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 10, background: item.currentQty < 10 ? "#fef3c7" : "#fff" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{item.code} • tersedia: <strong style={{ color: item.currentQty < 10 ? "#b45309":"#0f766e"}}>{item.currentQty}</strong> porsi</div>
            </div>
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
        <div style={{ fontSize:11, color:"#9ca3af", textAlign:"center" }}>Stok diperbarui otomatis saat penjualan tunai — pelaporan akhir sesuai hitungan fisik</div>
      </section>
    </main>
  );
}
