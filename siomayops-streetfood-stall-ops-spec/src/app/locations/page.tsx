"use client";
import { useState, useEffect } from "react";
import { TapTarget } from "@/shared/ui/TapTarget";

interface Location {
  id: string;
  name: string;
  status: string;
  areaId: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/locations")
      .then(r => r.json())
      .then(d => {
        setLocations(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Lokasi Jualan</h1>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Laporan lokasi adalah eksplisit per shift, bukan tracking terus-menerus.</p>

      {loading ? <p>Memuat...</p> : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {locations.map(loc => (
            <div key={loc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{loc.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{loc.status} • {loc.areaId}</div>
            </div>
          ))}
          {locations.length === 0 && <p style={{ color: "#9ca3af" }}>Belum ada lokasi.</p>}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <TapTarget minSize={44} label="Kembali" onClick={() => window.history.back()}>Kembali</TapTarget>
      </div>
    </main>
  );
}
