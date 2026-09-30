import React from "react";

export default function RecordingsLibraryPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/" style={{ color: "#286447", fontWeight: 700 }}>← Beranda</a>
      <header style={{ marginTop: 18 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Privasi dan perlindungan data</p>
        <h1 style={{ margin: "6px 0", fontSize: 28 }}>Arsip rekaman</h1>
      </header>
      <section aria-labelledby="recordings-unavailable" role="status" style={{ marginTop: 18, padding: 20, border: "1px solid #d8c58f", borderRadius: 12, background: "#fff9e9" }}>
        <h2 id="recordings-unavailable" style={{ margin: "0 0 8px", fontSize: 20 }}>Perpustakaan rekaman belum tersedia</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          Sistem belum menyediakan arsip rekaman percakapan. Halaman ini tidak mencari, membuka, atau memutar audio dan tidak menampilkan transkrip maupun metadata rekaman.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 650 }}>
          Perekaman mikrofon tetap dinonaktifkan sesuai kebijakan privasi. Tidak ada pilihan retensi, label pembicara, tautan insiden, atau tindakan hapus/arsip yang dapat dilakukan di sini.
        </p>
      </section>
      <p style={{ marginTop: 16, color: "#59685f", lineHeight: 1.6 }}>
        Lihat <a href="/operator/recordings/new" style={{ color: "#286447", fontWeight: 700 }}>status perekam percakapan</a>. Halaman tersebut juga tidak meminta akses mikrofon.
      </p>
    </main>
  );
}
