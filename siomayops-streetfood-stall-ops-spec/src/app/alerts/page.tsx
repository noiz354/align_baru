"use client";

export default function AlertsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Peringatan</h1>
        <a href="/" style={{ fontSize: 14, color: "#0f766e" }}>Beranda</a>
      </header>
      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8, border: "1px solid #fde68a" }}>
          <strong style={{ fontSize: 13 }}>Harga baru perlu diakui</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#92400e" }}>Set harga Siomay Ayam berubah menjadi Rp 16.000 efektif besok.</p>
        </div>
        <div style={{ padding: 12, background: "#dbeafe", borderRadius: 8, border: "1px solid #bfdbfe" }}>
          <strong style={{ fontSize: 13 }}>Stok menipis: Kulit Pangsit</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#1e40af" }}>Sisa 5 di gerobak ST-001, pertimbangkan restock.</p>
        </div>
        <div style={{ padding: 12, background: "#f3f4f6", borderRadius: 8 }}>
          <strong style={{ fontSize: 13 }}>Verifikasi pembayaran</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>1 pembayaran QRIS menunggu verifikasi HQ.</p>
        </div>
      </section>
    </main>
  );
}
