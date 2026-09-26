# Offline Architecture & Sync Strategy (OFFLINE.md)
## Sinkronisasi Transaksional Outbox, Resolusi Konflik, & Integritas Data

---

### 1. Filosofi Offline-First
Aplikasi juru parkir dirancang dengan premis: **"Koneksi internet adalah fitur opsional, bukan ketergantungan fatal."**
Seluruh alur kerja operasional:
- Check-in
- Ambil Foto
- Pindah Slot
- Hitung Tarif
- Pembayaran Kas
- Cetak Tiket
berjalan 100% secara lokal di perangkat tanpa membuat panggilan jaringan asinkron yang menghambat UI (*zero network blocking*).

---

### 2. Pola Transactional Outbox
Setiap mutasi domain menghasilkan entri di tabel `outbox_events` dalam transaksi basis data lokal yang sama (ACID atomik):

```
+--------------------------------------------------------------------------+
|                      LOCAL SQLITE TRANSACTION (ATOMIC)                   |
|                                                                          |
|  1. UPDATE parking_slots SET status = 'OCCUPIED' WHERE id = 'A-04';      |
|  2. INSERT INTO parking_sessions (...) VALUES (...);                     |
|  3. INSERT INTO photo_evidence (...) VALUES (...);                       |
|  4. INSERT INTO outbox_events (event_id, event_type, payload, status)    |
|     VALUES ('evt_101', 'VehicleCheckedIn', '{...}', 'PENDING');          |
+--------------------------------------------------------------------------+
```

---

### 3. Sync Engine Worker
Sebuah *Background Worker* berjalan secara terisolasi:
1. Memeriksa ketersediaan koneksi internet (*Network Reachability Listener*).
2. Membaca batch `outbox_events` berstatus `PENDING` (misal 50 event per batch).
3. Mengirimkan ke Server Cloud via endpoint `/api/v1/sync/push`.
4. Jika server merespons HTTP `200 OK` dengan daftar ID yang diterima, worker memperbarui status event lokal menjadi `ACKNOWLEDGED`.
5. Menghapus event yang sudah berstatus `ACKNOWLEDGED` setelah 7 hari.

---

### 4. Resolusi Konflik (Conflict Resolution Strategy)

| Skenario Konflik | Strategi Resolusi | Logika Bisnis |
| :--- | :--- | :--- |
| **Dua Attendant Offline Mengalokasikan Slot yang Sama** | Invariant Rule: Slot Possession | Sesi yang memiliki *earliest confirmed monotonic timestamp* mempertahankan slot. Sesi kedua secara otomatis dialihkan sistem ke status *Relocation Pending* dan attendant kedua mendapat notifikasi untuk memilih slot lain. |
| **Kendaraan Masuk di Pos 1, Keluar di Pos 2 saat Keduanya Offline** | Local QR Manifest Token | Tiket QR membawa signed payload mini (Plat, Jam Masuk, Hash Tiket). Pos 2 dapat membaca payload QR, menghitung tarif offline, menerima uang, dan menerbitkan event checkout ke Outbox. |
| **Edit Data Plat vs Checkout Bersamaan** | Entity Versioning / LWW | Perubahan plat yang disetujui supervisor menang, data sesi diperbarui sebelum status sesi ditutup. |
