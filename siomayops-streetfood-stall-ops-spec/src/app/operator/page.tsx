"use client";
import { useState, useEffect } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";

export default function OperatorPage() {
  const [operator, setOperator] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/operators/me")
      .then(r => r.json())
      .then(d => {
        setOperator(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Profil Operator</h1>

      {loading ? <p>Memuat...</p> : operator ? (
        <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{operator.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Status: {operator.status}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Area: {operator.areaId}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Kontrak: {operator.contractType}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Pelatihan: {operator.trainingState}</div>
          <div style={{ marginTop: 12, padding: 10, background: "#f0fdf4", borderRadius: 8, fontSize: 12 }}>
            Akun ini hanya melihat shift dan penjualan sendiri (self scope). Supervisor melihat area.
          </div>
        </div>
      ) : <p>Profil tidak ditemukan.</p>}

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="/operator/traffic-sampling" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, borderRadius: 10, padding: "0 16px", background: "#0f766e", color: "#fff", fontWeight: 750, textDecoration: "none" }}>
          Sampel arus pengunjung
        </a>
        <a href="/operator/site-condition" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, borderRadius: 10, padding: "0 16px", background: "#175b3c", color: "#fff", fontWeight: 750, textDecoration: "none" }}>
          Kondisi cuaca & lokasi
        </a>
        <a href="/operator/incidents/new" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, borderRadius: 10, padding: "0 16px", background: "#8b392e", color: "#fff", fontWeight: 750, textDecoration: "none" }}>
          Laporkan kejadian
        </a>
      </div>

      <div style={{ marginTop: 24 }}>
        <TapTarget minSize={44} label="Kembali" onClick={() => window.history.back()}>Kembali</TapTarget>
      </div>
    </main>
  );
}
