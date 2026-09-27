# Engineering Roadmap (ROADMAP.md)
## Tahapan Implementasi dari MVP hingga Skala Enterprise

---

### Fase 1: Core Foundation & MVP Lapangan (Sprint 1 - 4)
- [x] Desain Arsitektur Local-First & Model Domain Lengkap.
- [x] Implementasi Local Database SQLite & Entitas Domain (Vehicle, Slot, Session, Shift).
- [x] Fitur Check-In Cepat dengan input plat manual & pemilihan tipe kendaraan.
- [x] Modul Foto Bukti Awal & Form Observasi Barang Tertinggal (Non-asumsi).
- [x] Manajemen Slot (Empty, Occupied, Reserved, Blocked) & Fitur Move Vehicle.
- [x] Fitur Check-Out dengan kalkulasi tarif waktu sistem, pembayaran tunai/kembalian.
- [x] Buka/Tutup Shift Juru Parkir & Rekonsiliasi Kas Sederhana.
- [x] Pelaporan Insiden Lapangan (Form bodi rusak & catatan insiden).
- [x] Pencetakan Tiket Thermal 58mm via ESC/POS (builder; transport Bluetooth device-specific).

---

### Fase 2: Edge AI OCR & Outbox Synchronization (Sprint 5 - 8)
- [ ] Integrasi model On-Device OCR untuk auto-scan plat nomor Indonesia.
- [ ] Background Sync Engine dengan Transactional Outbox Pattern & TLS Pinning.
- [ ] Fitur Verifikasi Tiket Hilang (Lost Ticket Flow) dengan otorisasi PIN Supervisor.
- [ ] Side-by-side mismatch visual comparator pada layar checkout.
- [ ] Dukungan pembayaran QRIS Dinamis/Statis dengan parsing bukti bayar offline/online.

---

### Fase 3: Smart Telemetry, Heatmap, & Governance (Sprint 9 - 12)
- [ ] Visual Heatmap utilisasi slot dan waktu puncak (peak-hour occupancy).
- [ ] Alerting otomatis Overstay (> 12 jam & > 24 jam) dengan eskalasi push notification.
- [ ] Automated Retention Runner (Pembersihan foto 30 hari & anonymization plat nomor).
- [ ] Multi-attendant slot locking via Wi-Fi Mesh lokal (P2P zero-cloud sync antar pos).
- [ ] Dashboard analitik omset dan KPI kinerja juru parkir per pos.
