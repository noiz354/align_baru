# Privacy & Data Governance Specification (PRIVACY.md)
## Kepatuhan UU PDP / GDPR, Penyamaran Plat Nomor, & Penghapusan Otomatis

---

### 1. Klasifikasi Data Privasi
Dalam konteks operasional juru parkir:
- **Data Sensitif Terbatas**:
  1. **Nomor Registrasi Kendaraan Bermotor (Plat Nomor)**: Menghubungkan kendaraan dengan mobilitas pemilik di titik lokasi tertentu.
  2. **Foto Kendaraan & Sekitar**: Berpotensi menangkap wajah pengendara, anak kecil, atau barang pribadi di dalam kaca mobil.
  3. **Identitas Pengendara pada Kasus Lost Ticket**: Foto KTP/SIM dan nomor NIK.

---

### 2. Kebijakan Retensi & Pembersihan Terjadwal (Data Retention Policy)

```
[ Transaksi Check-out Selesai ]
               │
               ▼
   [ Disimpan di Local Storage & Cloud Hub: 30 Hari ]
   (Untuk melayani komplain, audit finansial, atau klaim asuransi)
               │
               ├─────────────────────────────────┐
               ▼                                 ▼
   [ Tidak Ada Insiden Terbuka ]       [ Ada Kasus Insiden Terbuka ]
               │                                 │
               ▼                                 ▼
   [ HARI KE-30: JALANKAN RETENTION RUNNER ]   [ TANGGUHKAN PENGHAPUSAN ]
   1. Hapus file foto bodi kendaraan           (Freeze hingga kasus selesai)
   2. Hapus foto KTP/STNK klaim lost ticket
   3. Anonimkan plat nomor di tabel audit:
      "B 1234 ABC" -> "B 1*** ABC"
               │
               ▼
   [ STATUS: PERMANENTLY ANONYMIZED ]
```

---

### 3. Masking & Minimisasi Data
- **Di Layar Dashboard Umum**: Plat nomor dapat ditampilkan secara utuh hanya pada daftar aktif di lapangan. Pada laporan ringkasan umum bulanan, sistem menyediakan opsi masking (`B 1*** **G`).
- **Pencegahan Wajah (Face Blur)**: Pada pipeline kamera lanjutan, jika terdeteksi wajah manusia di dekat jendela atau kemudi kendaraan, filter blur ringan diterapkan secara otomatis sebelum disimpan ke disk bukti operasional.

---

### 4. Hak Subjek Data (Data Subject Rights)
- Jika pelanggan meminta verifikasi atau penghapusan data foto setelah kendaraan keluar, juru parkir mengarahkan ke form DPO (Data Protection Officer) pengelola parkir.
- Foto tidak pernah diunggah ke media sosial publik, server pihak ketiga yang tidak berizin, atau dibagikan ke grup chat pribadi antar juru parkir.
