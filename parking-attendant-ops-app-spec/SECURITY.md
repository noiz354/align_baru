# Security & Access Control Specification (SECURITY.md)
## Autentikasi, Otorisasi, Enkripsi, & Pencegahan Fraud

---

### 1. Role-Based Access Control (RBAC)

| Izin Operasional (Permission) | Attendant (Juru Parkir) | Supervisor (Kepala Regu) | Auditor / Admin Pusat |
| :--- | :---: | :---: | :---: |
| Check-in Kendaraan | ✅ | ✅ | ❌ |
| Check-out & Terima Kas/QRIS | ✅ | ✅ | ❌ |
| Pindah Slot Kendaraan | ✅ | ✅ | ❌ |
| Ambil Foto Kondisi Kendaraan | ✅ | ✅ | ❌ |
| Lapor Insiden Baru | ✅ | ✅ | ❌ |
| Override Tarif / Gratis / Diskon | ❌ | ✅ (Wajib PIN/Biometrik) | ❌ |
| Eksekusi Lost Ticket | ❌ | ✅ | ❌ |
| Edit Plat Nomor Pasca Check-in | ❌ | ✅ | ❌ |
| Buka / Tutup Rekonsiliasi Shift | ✅ (Self) | ✅ (Semua Anggota) | ❌ |
| Lihat Audit Log Lengkap | ❌ | Read-Only | ✅ |
| Konfigurasi Skema Tarif | ❌ | ❌ | ✅ |

---

### 2. Pencegahan Kecurangan (Anti-Fraud Controls)
1. **Pencegahan Jam Palsu (Clock Skew Tampering)**:
   - Juru parkir curang mungkin memundurkan jam HP agar durasi parkir mobil kerabatnya menjadi 0 menit.
   - *Mitigasi*: Aplikasi mengunci clock sistem menggunakan `SystemClock.elapsedRealtime()` (Monotonic hardware counter) dan secara periodik melakukan validasi delta NTP saat online. Jika terdeteksi clock melompat mundur secara drastis, aplikasi mengunci mode checkout dan meminta validasi supervisor.
2. **Pencegahan Ghost Check-in / Ghost Release**:
   - Check-in palsu untuk memblokir slot, atau checkout palsu tanpa menarik uang.
   - *Mitigasi*: Check-in wajib melampirkan minimal 1 frame foto kendaraan asli (dianalisis rasio kontras dasar/metadata kamera). Setiap rilis manual wajib memiliki alasan dan supervisor ID.
3. **Pemisahan Kas Tunai**:
   - Uang tunai yang dilaporkan di shift tidak dapat diubah oleh attendant setelah form tutup shift ditekan (*immutable submission*).

---

### 3. Enkripsi & Proteksi Data di Perangkat (At-Rest & In-Transit)
- **Database Lokal**: Menggunakan **SQLCipher (AES-256-GCM)** dengan kunci enkripsi yang diturunkan dari Android Keystore / Hardware-backed Keystore.
- **File Foto**: Disimpan di direktori privat aplikasi (Scoped Storage), terenkripsi atau terisolasi dari akses aplikasi lain di perangkat.
- **Komunikasi Jaringan**: Semua komunikasi sinkronisasi keluar menggunakan **TLS 1.3** dengan Certificate Pinning ke API gateway pusat.
