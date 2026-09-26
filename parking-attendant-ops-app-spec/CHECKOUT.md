# Check-Out Workflow Specification (CHECKOUT.md)
## Verifikasi Kendaraan Keluar, Mismatch Alert, & Lost Ticket

---

### 1. Diagram Alur Check-Out
```
+--------------------------------------------------------------------------+
|                      LANGKAH 1: IDENTIFIKASI KELUAR                      |
| - Pelanggan menyerahkan Tiket QR / Attendant scan kamera                 |
|   ATAU Attendant input plat nomor jika tiket tidak terbaca               |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                  LANGKAH 2: VERIFIKASI & MISMATCH CHECK                  |
| - Sistem menarik data sesi aktif berdasarkan Sesi ID / Plat              |
| - Layar menampilkan: Plat, Tipe, Warna, dan Foto Kondisi Awal            |
| - Evaluasi Mismatch:                                                     |
|   * Plat tidak sesuai? -> MISMATCH ALERT (Wajib Otorisasi)              |
|   * Warna / Jenis kendaraan berbeda? -> Tahan di pos                     |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                     LANGKAH 3: KALKULASI DURASI & TARIF                  |
| - Hitung Durasi = Current Monotonic Time - check_in_time                 |
| - Pricing Engine menerapkan aturan tarif zona & tipe kendaraan           |
| - Tampilkan rincian nominal ke attendant & pelanggan                     |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                   LANGKAH 4: PENYELESAIAN PEMBAYARAN                     |
| - Pilihan: [TUNAI] (hitung uang diterima & kembalian) atau [QRIS]        |
| - Kasus Khusus: [OVERRIDE / WAIVED] (wajib menyertakan alasan + PIN Spv) |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                    LANGKAH 5: RELEASE SLOT & AUDIT                       |
| - Ubah status sesi menjadi CHECKED_OUT                                   |
| - Ubah status slot asal menjadi EMPTY                                    |
| - Cetak struk keluar jika diminta                                        |
| - Rekam mutasi kas ke shift attendant yang bertugas                      |
+--------------------------------------------------------------------------+
```

---

### 2. Penanganan Mismatch Alert
Mismatch terjadi jika kendaraan yang keluar dicurigai bukan kendaraan yang sah saat masuk.
1. **Trigger Kondisi**:
   - Plat terdeteksi berbeda dengan QR tiket.
   - Attendant secara manual menandai *"Kendaraan Berbeda Fisik"*.
2. **Prosedur Lapangan**:
   - Suara peringatan *hazard alert* berbunyi pada aplikasi.
   - Pintu keluar/jalur ditahan.
   - Tampilkan foto saat masuk berdampingan dengan kamera fisik sekarang (*side-by-side view*).
   - Hubungi Kepala Regu (Supervisor) untuk validasi STNK dan identitas pengemudi.

---

### 3. Penanganan Tiket Hilang (Lost Ticket Flow)
1. Pelanggan menyatakan kehilangan tiket fisik/QR.
2. Attendant memilih menu **"Lost Ticket Resolution"**.
3. Cari kendaraan di database sesi aktif berdasarkan plat nomor atau ciri kendaraan.
4. **Validasi Wajib**:
   - Meminta STNK asli kendaraan.
   - Meminta KTP / SIM pengendara.
   - Memasukkan Nama & NIK pengendara ke dalam form Lost Ticket.
   - Foto STNK & KTP (tersimpan terenkripsi dengan audit log).
5. **Kalkulasi Biaya Tiket Hilang**:
   - `Total Bayar = Biaya Parkir Berjalan + Denda Tiket Hilang (misal Rp 20.000 untuk motor / Rp 50.000 untuk mobil)`.
6. **Otorisasi**: Memerlukan PIN Supervisor shift untuk membuka tombol cetak tanda keluar.
