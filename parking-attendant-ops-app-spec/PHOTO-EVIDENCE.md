# Photo Evidence & Observational Metadata (PHOTO-EVIDENCE.md)
## Standar Bukti Visual, Watermark, Hash Integritas, & Observasi Non-Asumsi

---

### 1. Prinsip Yuridis Observasi Visual
Untuk menghindari perselisihan hukum antara juru parkir dan pemilik kendaraan:
1. **Prinsip Observasi Murni (Pure Visual Observation)**:
   - Sistem mencatat *"terlihat 1 tas ransel abu-abu di gantungan depan"* bukan *"juru parkir menerima titipan tas ransel berharga milik Pak A"*.
   - Tidak ada asumsi nilai ekonomis atau isi dari barang yang terlihat.
2. **Kondisi Bodi Awal (Pre-existing Damage)**:
   - Foto kondisi bodi berfungsi membuktikan bahwa baret, penyok, lampu pecah, atau spion patah **sudah ada** saat kendaraan masuk ke area parkir.

---

### 2. Standar Metadata Bukti Foto (Photo Evidence Envelope)
Setiap file foto yang ditangkap oleh kamera aplikasi wajib dienkapsulasi dengan metadata yang tidak dapat diubah:

| Atribut Metadata | Keterangan |
| :--- | :--- |
| `evidence_id` | UUID unik bukti visual. |
| `session_id` | Relasi ke sesi parkir terkait. |
| `perspective` | Sudut pengambilan (`FRONT`, `REAR`, `SIDE_LEFT`, `SIDE_RIGHT`, `CARGO_OPEN`, `DAMAGE_DETAIL`). |
| `file_path` | Jalur penyimpanan lokal terenkripsi. |
| `file_hash_sha256` | Hash kriptografis file foto saat disimpan (untuk audit anti-rekayasa di pengadilan). |
| `captured_at` | Timestamp sistem presisi milidetik saat foto diambil. |
| `attendant_id` | Identitas juru parkir yang mengambil foto. |
| `geo_coordinates` | Koordinat GPS (latitude, longitude, akurasi) perangkat saat penangkapan. |
| `device_id` | Identitas hardware smartphone/POS. |

---

### 3. Burn-in Watermark Visual
Saat foto disimpan atau diexport untuk keperluan dispute/insiden, sistem secara otomatis membubuhkan watermark visual permanen di pojok kanan bawah:
```
+--------------------------------------------------------+
|                                                        |
|             [ GAMBAR KENDARAAN / FOTO ]                |
|                                                        |
|                                                        |
|             ------------------------------------------ |
|             PLAT: B 4821 SSG | SLOT: A-04             |
|             TIME: 2026-09-26 09:15:30 WIB             |
|             PETUGAS: BUDI (ID: att_08)                |
|             HASH: 4b2f8a... (EVIDENCE VERIFIED)       |
+--------------------------------------------------------+
```

---

### 4. Kompresi & Efisiensi Penyimpanan
- Resolusi asli kamera smartphone (12-50 MP) terlalu besar untuk penyimpanan ratusan kendaraan harian di perangkat mobile.
- **Standar Kompresi Lapangan**:
  - Format: WebP atau JPEG Progresif (Kualitas 80%).
  - Resolusi Maksimal: 1600x1200 piksel (cukup tajam membaca baret bodi dan plat nomor).
  - Target Ukuran File: ~150 KB - 250 KB per foto.
  - Waktu Proses: Di bawah 350 milidetik di background thread.
