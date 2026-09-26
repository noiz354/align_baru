# Architecture Decision Records (ADR.md)

---

### ADR-001: Local-First Embedded Database dengan SQLite & Outbox Sync
- **Status**: ACCEPTED
- **Konteks**: Juru parkir bekerja di basement mal, pinggir jalan pegunungan, dan pasar tumpah dengan koneksi internet yang sering *drop* atau *intermittent*. Operasi check-in dan keluar tidak boleh terhenti sedetik pun.
- **Keputusan**: Mengadopsi arsitektur *Local-First* menggunakan SQLite lokal terenkripsi di perangkat juru parkir sebagai sumber kebenaran primer saat transaksi lapangan berlangsung, dipadukan dengan *Transactional Outbox Table* untuk sinkronisasi latar belakang ke server saat online.
- **Konsekuensi**: 
  - (+) Latensi transaksi nol milidetik (sub-second UI response).
  - (+) Tahan offline 100%.
  - (-) Perlu mekanisme *conflict resolution* untuk slot ganda dan deduplikasi sinkronisasi outbox.

---

### ADR-002: Pemisahan Ketat Timestamp Sistem vs Metadata Foto untuk Kalkulasi Tarif
- **Status**: ACCEPTED
- **Konteks**: Foto kendaraan memiliki metadata EXIF, namun jam kamera EXIF dapat dimanipulasi, terlambat tersimpan, atau dikompresi ulang. Diperlukan kepastian hukum dan finansial mengenai dasar kalkulasi biaya parkir.
- **Keputusan**: Waktu kalkulasi tarif parkir **100% wajib menggunakan Monotonic System Timestamp** dari kernel/server yang terenkripsi dan terlindungi anti-tampering. Foto kendaraan masuk dan keluar **hanya berstatus sebagai alat bukti pendukung (evidence)** untuk mencocokkan fisik kendaraan dan menyelesaikan sengketa, bukan parameter input kalkulasi tarif.
- **Konsekuensi**:
  - (+) Tidak ada bug tarif akibat lag kamera atau re-encoding foto.
  - (+) Perlindungan audit dari manipulasi jam perangkat.

---

### ADR-003: Klasifikasi Hukum Pencatatan Barang sebagai "Observasi Lapangan"
- **Status**: ACCEPTED
- **Konteks**: Konsumen sering menuntut ganti rugi helm hilang atau barang tertinggal di motor/mobil jika juru parkir mencatat barang tersebut sebagai "barang titipan".
- **Keputusan**: Sistem secara eksplisit melabeli kolom pencatatan sebagai `observed_visible_items` (Observasi Visual Barang Tertinggal). Di tingkat domain, pencatatan ini berstatus *unverified visual observation*, bukan kontrak penitipan barang (*bailment contract*). Syarat & Ketentuan di tiket mencantumkan penafian hukum tersebut.
- **Konsekuensi**:
  - (+) Melindungi juru parkir dan pengelola dari klaim sepihak.
  - (+) Tetap memberikan transparansi apakah barang tersebut memang ada di kendaraan saat masuk.

---

### ADR-004: Penjadwalan Pembersihan Data (Data Retention) & Masking Plat Nomor
- **Status**: ACCEPTED
- **Konteks**: Berdasarkan undang-undang privasi (UU PDP Indonesia / GDPR), plat nomor kendaraan yang dikaitkan dengan lokasi dan waktu merupakan data pribadi spesifik yang tidak boleh disimpan tanpa batas waktu.
- **Keputusan**:
  - Foto kendaraan dan detail plat nomor sesi parkir yang sudah selesai (`CHECKED_OUT`) tanpa insiden aktif dihapus/di-purge otomatis setelah **30 hari**.
  - Log audit histori tetap ada, tetapi string plat dimasker (misal: `B 1*** ABC`) setelah masa retensi terlewati.
  - Sesi yang memiliki bendera `INCIDENT_ACTIVE` dikecualikan dari penghapusan otomatis sampai kasus diselesaikan oleh manajemen.
- **Konsekuensi**:
  - (+) Kepatuhan hukum privasi data terjamin.
  - (+) Menghemat kapasitas penyimpanan lokal pada perangkat juru parkir.

---

### ADR-005: Penanganan Tiket Hilang (Lost Ticket) dengan Dual-Authorization
- **Status**: ACCEPTED
- **Konteks**: Tiket hilang adalah titik rawan pencurian kendaraan (curanmor) dan manipulasi uang tunai parkir oleh oknum juru parkir.
- **Keputusan**: Flow checkout tiket hilang wajib melalui verifikasi STNK fisik yang dicocokkan dengan plat nomor sistem, pengambilan foto STNK/KTP pengendara, dan otorisasi PIN Supervisor (*dual-authorization*). Denda tiket hilang dihitung otomatis oleh pricing engine.
- **Konsekuensi**:
  - (+) Keamanan aset kendaraan pelanggan terjamin dari sindikat curanmor.
  - (+) Menutup celah penggelapan kas denda tiket hilang.
