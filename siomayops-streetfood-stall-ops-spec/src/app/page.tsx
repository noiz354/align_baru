"use client";

import { useState, useEffect } from "react";
import { OfflineBanner } from "@/shared/ui/OfflineBanner";
import { TapTarget } from "@/shared/ui/TapTarget";

export default function Page() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount] = useState(0);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      <OfflineBanner isOffline={isOffline} pendingRecordCount={pendingCount} />
      <header style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>SiomayOps</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>Beranda penjual</p>
      </header>

      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <TapTarget minSize={72} label="Mulai Shift" onClick={() => (window.location.href = "/shift")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TapTarget minSize={44} label="Jualan" onClick={() => (window.location.href = "/sell")}>
            Jualan
          </TapTarget>
          <TapTarget minSize={44} label="Stok" onClick={() => (window.location.href = "/stock")}>
            Stok
          </TapTarget>
          <TapTarget minSize={44} label="Pengeluaran" onClick={() => (window.location.href = "/expenses")}>
            Pengeluaran
          </TapTarget>
          <TapTarget minSize={44} label="Tutup Shift" onClick={() => (window.location.href = "/closing")}>
            Tutup Shift
          </TapTarget>
        </div>
        <div style={{ marginTop: 8, padding: 12, background: "#f3f4f6", borderRadius: 10 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Akses Cepat HQ</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href="/hq" style={{ fontSize: 13, color: "#0f766e", textDecoration: "none", fontWeight: 600 }}>Dashboard HQ →</a>
            <a href="/alerts" style={{ fontSize: 13, color: "#0f766e", textDecoration: "none", fontWeight: 600 }}>Peringatan →</a>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: "auto", padding: 16, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
        SiomayOps v0.1 — Offline-first • Uang presisi • Lokasi dilaporkan
      </footer>
    </main>
  );
}
