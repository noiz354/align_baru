"use client";

export default function HQIncidentsPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Board Insiden</h1>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Insiden dilaporkan netral, eskalasi oleh manusia.</p>
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>INC-001 — Peralatan rusak</strong>
            <span style={{ background: "#fee2e2", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>HIGH</span>
          </div>
          <p style={{ fontSize: 13, color: "#374151", margin: "8px 0 0" }}>Kompor gerobak ST-001 tidak menyala di lokasi Alun-alun</p>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button style={{ fontSize: 12, padding: "4px 8px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6 }}>Acknowledge</button>
            <button style={{ fontSize: 12, padding: "4px 8px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 }}>Resolve</button>
          </div>
        </div>
      </div>
      <a href="/hq" style={{ display: "inline-block", marginTop: 16, fontSize: 14, color: "#0f766e" }}>← Kembali ke Dashboard</a>
    </main>
  );
}
