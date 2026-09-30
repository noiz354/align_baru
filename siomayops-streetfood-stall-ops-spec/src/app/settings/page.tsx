import React from "react";

export default function SettingsAccessPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/" style={{ color: "#286447", fontWeight: 700 }}>← Beranda</a>
      <header style={{ marginTop: 18 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Akun dan keamanan</p>
        <h1 style={{ margin: "6px 0", fontSize: 28 }}>Pengaturan, pengguna &amp; akses</h1>
      </header>
      <section aria-labelledby="settings-unavailable" role="status" style={{ marginTop: 18, padding: 20, border: "1px solid #d8c58f", borderRadius: 12, background: "#fff9e9" }}>
        <h2 id="settings-unavailable" style={{ margin: "0 0 8px", fontSize: 20 }}>Pengelolaan akun dan akses belum tersedia</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          Aplikasi belum memiliki sumber akun dan pengaturan persisten yang dapat ditampilkan atau diubah di halaman ini. Informasi peran di kode maupun nilai ambang bawaan bukan bukti akses atau pengaturan tersimpan untuk pengguna tertentu.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 650 }}>
          Halaman ini tidak menampilkan profil, peran efektif, akses organisasi/outlet, atau nilai pengaturan; halaman ini juga tidak mengundang pengguna, mengubah akses, menyimpan pengaturan, maupun mencabut sesi/perangkat.
        </p>
      </section>
      <p style={{ marginTop: 16, color: "#59685f", lineHeight: 1.6 }}>
        Layanan autentikasi produksi belum tersedia. Pengelolaan akses hanya dapat dibuka setelah identitas, cakupan akses, penyimpanan, dan audit yang sebenarnya siap.
      </p>
    </main>
  );
}
