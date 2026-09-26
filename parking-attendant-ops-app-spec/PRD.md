# Product Requirements Document (PRD)
## Parking Attendant Operations App (Sistem Operasi Juru Parkir Lapangan)

---

### 1. Eksekutif & Problem Statement
Aplikasi parkir konvensional umumnya dirancang untuk *barrier gate* otomatis atau reservasi konsumen (driver-facing). Namun, di lapangan (lapangan ruko, pasar, festival, gedung komersial semi-terbuka, parkir pinggir jalan/on-street), kendali operasional sepenuhnya dipegang oleh **juru parkir (attendant)**.

Permasalahan kritis di lapangan:
1. **Sengketa Kondisi Kendaraan & Kehilangan**: Tuduhan helm hilang, baret bodi, atau spion patah tanpa adanya bukti kondisi awal (*baseline condition evidence*).
2. **Kekacauan Posisi & Slot**: Kendaraan dipindahkan tanpa pencatatan, juru parkir lupa posisi kendaraan saat pemilik hendak pulang.
3. **Kebocoran & Discrepancy Kas**: Ketidaksesuaian uang tunai saat pergantian shift (*shift handover*) dan manipulasi durasi/tarif.
4. **Kendaraan Overstay & Hilang Tiket**: Kendaraan menginap berhari-hari tanpa identitas jelas, atau klaim tiket hilang (*lost ticket*) tanpa validasi kepemilikan STNK.
5. **Konektivitas Lapangan yang Labil**: Sinyal buruk di basement atau area outdoor menuntut reliabilitas offline-first.

### 2. Visi Produk
Menghadirkan **Parking Attendant Operations App** yang cepat, ergonomis (thumb-friendly untuk operasional satu tangan), akuntabel, dan mengutamakan pencatatan berbasis bukti digital (*photo evidence & timestamp audit trail*) tanpa memperlambat alur kendaraan masuk dan keluar.

---

### 3. Persona Pengguna
| Persona | Peran & Kebutuhan Utama | Alat Kerja |
| :--- | :--- | :--- |
| **Juru Parkir Lapangan (Attendant)** | Check-in cepat (<10 detik), foto kondisi motor/mobil, assign slot, pindah slot, check-out, terima tunai/QRIS. | Smartphone Android Rugged / Handheld POS dengan kamera & printer thermal. |
| **Kepala Regu / Koordinator Shift (Supervisor)** | Serah terima shift, rekonsiliasi kas, approval override/lost ticket, tangani incident report. | Tablet / Smartphone. |
| **Manajer Operasional / Auditor** | Monitoring kapasitas real-time, audit trail, rekap pendapatan, kepatuhan privasi data plat. | Web Dashboard Laptop / PC. |

---

### 4. Batasan & Ruang Lingkup Rilis

#### A. Versi MVP (In-Scope Rilis Awal)
1. **Zona & Slot Parkir**: Area, slot ID, kapasitas, tipe kendaraan, status (*EMPTY, OCCUPIED, RESERVED, BLOCKED*).
2. **Check-in Kendaraan**: Input/scan plat nomor, tipe kendaraan (Motor, Mobil, Sepeda, Truk/Besar), warna, assign slot awal.
3. **Foto Kondisi Awal**: Bukti visual bodi dan observasi barang tertinggal (helm, jaket, tas, paket) sebagai *observasi visual murni* (bukan penjaminan kepemilikan).
4. **Occupied State & Move Vehicle**: Pelacakan kendaraan di slot mana, sejak kapan, serta pencatatan pemindahan slot (*relocation log*).
5. **Pencarian Kendaraan Ergonomis**: Pencarian cepat via plat nomor, warna, jenis, atau slot ID.
6. **Check-out & Kalkulasi Tarif**: Scan plat/tiket QR, verifikasi visual, hitung durasi via timestamp sistem, kalkulasi tarif (flat, per jam, progresif, denda tiket hilang).
7. **Pembayaran & Status Kas**: Pembayaran Tunai, QRIS, tanda pending/override, penerbitan struk/tiket digital.
8. **Shift Management & Handover**: Buka shift (modal awal kas), catat transaksi, serah terima sisa kendaraan aktif (*inventory handover*), tutup shift & rekonsiliasi kas.
9. **Incident Reporting**: Pencatatan motor roboh, gesekan/baret, kehilangan helm, konflik pelanggan, kendaraan mogok.
10. **Audit Trail**: Pencatatan log immutable untuk setiap aksi finansial, edit plat, override, dan pemindahan kendaraan.

#### B. Fase Lanjutan (Post-MVP)
1. Edge OCR otomatis berakurasi tinggi (offline on-device LPR).
2. Sinkronisasi multi-node mesh offline via Wi-Fi Direct/Local Gateway.
3. Heatmap analitik utilisasi slot dan dwell-time per jam.
4. Auto-retention scheduler & anonymizer plat nomor otomatis sesuai GDPR/UU PDP.

---

### 5. Alur Kerja Utama (Core User Journeys)

#### 5.1 Alur Kendaraan Masuk (Check-In)
```
[Kendaraan Masuk]
       ↓
[Buka Kamera / Quick Check-in]
       ↓
[Input / Scan Plat Nomor & Pilih Tipe Kendaraan]
       ↓
[Ambil Foto Kondisi Awal & Catat Observasi Barang (Opsional)]
       ↓
[Pilih / Auto-suggest Slot Parkir]
       ↓
[Simpan: Status Slot → OCCUPIED | Cetak / Tampilkan Tiket QR]
       ↓
[Audit Log Tercatat: Timestamp, Slot, Attendant ID]
```

#### 5.2 Alur Kendaraan Keluar (Check-Out)
```
[Kendaraan Menuju Pintu Keluar]
       ↓
[Scan Tiket QR / Input Plat Nomor]
       ↓
[Sistem Menampilkan Info Kendaraan, Durasi, Foto Awal, & Nominal Tarif]
       ↓
[Pemeriksaan Kecocokan (Mismatch Check)] 
   ├─ Jika Tidak Cocok → Tampilkan Mismatch Alert / Masuk Verifikasi Supervisor
   └─ Jika Cocok → Lanjutkan ke Pembayaran
       ↓
[Proses Pembayaran (Tunai / QRIS)]
       ↓
[Pembayaran Lunas → Status Slot Kembali EMPTY]
       ↓
[Cetak Struk / Audit Log Selesai]
```

#### 5.3 Alur Tiket Hilang (Lost Ticket Flow)
```
[Pelanggan Lapor Tiket Hilang]
       ↓
[Attendant Pilih "Lost Ticket Verification"]
       ↓
[Cari Kendaraan via Plat / Ciri Fisik di Database Aktif]
       ↓
[Wajib Cek Fisik: Verifikasi STNK vs Plat Kendaraan]
       ↓
[Supervisor Approval / Override PIN]
       ↓
[Tarif Standar + Denda Tiket Hilang Dihitung]
       ↓
[Pembayaran & Log Audit Khusus Tersimpan]
```

---

### 6. Kriteria Keberhasilan (Success Metrics)
- **Waktu Check-in**: Maksimal 8-12 detik per kendaraan (termasuk 1 foto kondisi).
- **Waktu Check-out**: Maksimal 6 detik untuk pembayaran tunai/scan QR.
- **Tingkat Sengketa Kerusakan/Barang**: Penurunan >80% komplain pelanggan terkait baret dan barang hilang berkat bukti foto bertimestamp.
- **Selisih Kas Shift (Cash Variance)**: < 0.1% dari total omset kas harian.
- **Ketersediaan Offline**: 100% fungsionalitas check-in/out tetap berjalan tanpa latensi saat jaringan seluler terputus.
