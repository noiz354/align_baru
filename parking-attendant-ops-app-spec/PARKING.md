# Parking Module Specification (PARKING.md)
## Titik, Zona, Slot, Alokasi, & Move Vehicle

---

### 1. Struktur Zona & Slot Parkir
Sistem mendukung zonasi multi-level:
1. **Facility / Site**: Lokasi parkir fisik (contoh: "Pasar Baru Mall", "Ruko Fatmawati").
2. **Zone (Zona)**: Area spesifik (contoh: "Zona A (Depan Gerbang)", "Zona B (Sayap Kiri)", "Zona C (Basement)").
3. **Slot**: Identitas petak parkir individual yang memiliki:
   - `slot_id`: UUID unik internal.
   - `slot_code`: Kode fisik yang tercat pada marka (contoh: `A-01`, `B-15`, `M-09`).
   - `vehicle_type`: Tipe kendaraan yang diizinkan (`MOTORCYCLE`, `CAR`, `BICYCLE`, `TRUCK_HEAVY`).
   - `status`: State saat ini (`EMPTY`, `OCCUPIED`, `RESERVED`, `BLOCKED`).
   - `position_coordinates`: Koordinat X, Y relatif (untuk denah peta) atau lat/long GPS.

---

### 2. State Machine Slot Parkir
```
              +--------------------------+
              |          EMPTY           |
              +--------------------------+
                │            ▲        │
     Check-in   │            │        │ Supervisor Block
    Allocated   │            │ Free   │ (Maintenance/Genangan)
                ▼            │        ▼
      +--------------+       │     +--------------+
      |   OCCUPIED   |───────┤     |   BLOCKED    |
      +--------------+       │     +--------------+
             │               │            │
  Supervisor │               │            │ Unblock
     Reserve │               │            │
             ▼               │            ▼
      +--------------+       │     +--------------+
      |   RESERVED   |───────┘     |    EMPTY     |
      +--------------+             +--------------+
```

#### Aturan Transisi:
- **EMPTY ke OCCUPIED**: Terjadi otomatis saat alur Check-in berhasil dan dikonfirmasi oleh juru parkir.
- **OCCUPIED ke EMPTY**: Terjadi otomatis setelah alur Check-out diselesaikan dan status pembayaran `PAID` atau `OVERRIDE_WAIVED`.
- **OCCUPIED ke OCCUPIED (Move Vehicle)**: Slot lama kembali menjadi `EMPTY`, slot baru menjadi `OCCUPIED`. Riwayat perpindahan dicatat di `relocation_logs`.
- **EMPTY ke BLOCKED**: Tindakan manual juru parkir/supervisor jika slot tidak bisa digunakan (ada genangan air, perbaikan aspal, kabel putus).

---

### 3. Operasi Pemindahan Kendaraan (Move Vehicle)
Dalam operasional parkir motor dan mobil di Indonesia, juru parkir kerap memindahkan kendaraan untuk merapikan antrean atau mengeluarkan mobil lain yang terhalang.

#### Spesifikasi Fitur Move Vehicle:
1. **Pemicu**: Juru parkir memilih kendaraan (berdasarkan plat atau tap slot lama).
2. **Pilihan Aksi**: Pilih menu *"Pindahkan Kendaraan"*.
3. **Input Slot Baru**: Scan barcode/QR pada marka slot tujuan atau pilih dari daftar slot kosong.
4. **Alasan Pemindahan**:
   - `REORGANIZATION`: Penataan kerapian barisan.
   - `UNBLOCK_OTHER`: Mengeluarkan kendaraan lain yang terhalang.
   - `SAFETY`: Menghindari bahaya (atap bocor, sengatan matahari berlebih).
   - `CUSTOMER_REQUEST`: Permintaan langsung pemilik kendaraan.
5. **Audit Trail**: Mencatat juru parkir yang memindahkan, waktu pemindahan (*moved_at*), slot asal, dan slot tujuan. Notifikasi status slot terupdate seketika di dashboard shift.
