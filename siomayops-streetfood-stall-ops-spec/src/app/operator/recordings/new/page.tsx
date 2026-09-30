import React from "react";

export default function ConversationRecorderPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px", color: "#17251d", fontFamily: "system-ui, sans-serif" }}>
      <a href="/operator" style={{ color: "#286447", fontWeight: 700 }}>← Beranda operator</a>
      <header style={{ marginTop: 18 }}>
        <p style={{ margin: 0, color: "#68776e", fontSize: 12, fontWeight: 750, letterSpacing: ".06em", textTransform: "uppercase" }}>Privasi dan perlindungan data</p>
        <h1 style={{ margin: "6px 0", fontSize: 28 }}>Perekam percakapan</h1>
      </header>
      <section aria-labelledby="recorder-unavailable" role="status" style={{ marginTop: 18, padding: 20, border: "1px solid #d8c58f", borderRadius: 12, background: "#fff9e9" }}>
        <h2 id="recorder-unavailable" style={{ margin: "0 0 8px", fontSize: 20 }}>Fitur belum tersedia</h2>
        <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
          Aplikasi belum mengaktifkan perekaman audio atau transkripsi percakapan. Kebijakan privasi saat ini menolak akses mikrofon.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 650 }}>
          Halaman ini tidak meminta izin mikrofon, merekam, mengunggah, atau menyimpan audio. Tidak ada transkrip, label pembicara, pilihan masa simpan, atau tautan insiden yang dapat dibuat di sini.
        </p>
      </section>
      <p style={{ marginTop: 16, color: "#59685f", lineHeight: 1.6 }}>
        Jangan merekam percakapan untuk SiomayOps menggunakan halaman ini. Persetujuan pada halaman saja tidak mengaktifkan perekaman. Gunakan alur operasional tertulis yang sudah tersedia hanya bila sesuai dengan tujuannya.
      </p>
    </main>
  );
}
