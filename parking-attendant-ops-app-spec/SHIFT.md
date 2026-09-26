# Shift & Cash Reconciliation Specification (SHIFT.md)
## Manajemen Giliran Kerja, Modal Awal, & Rekonsiliasi Kas

---

### 1. Siklus Hidup Shift Juru Parkir
Setiap aktivitas finansial dan operasional wajib terikat pada satu `shift_id` aktif.

```
       [ Juru Parkir Datang & Login ]
                     │
                     ▼
       [ Buka Shift (Open Shift) ]
         - Input Kas Awal / Modal Kembalian (Cash Float)
         - Verifikasi Lokasi / Pos Bertugas
                     │
                     ▼
       [ Sesi Operasional Shift Berjalan ]
         - Terima Check-in
         - Check-out & Catat Penerimaan Tunai / QRIS
         - Mutasi Pengeluaran Lapangan (Beli Kertas Struk, dll jika ada)
                     │
                     ▼
       [ Serah Terima Shift (Shift Handover) ]
         - Opname Fisik: Kendaraan yang Masih Terparkir (Active Inventory)
         - Hitung Fisik Uang Kas (Cash Count)
                     │
                     ▼
       [ Tutup Shift (Close Shift) & Rekonsiliasi ]
         - Bandingkan Kas Fisik vs Kas Sistem (Variance Check)
         - Tanda Tangan Digital / PIN Supervisor
```

---

### 2. Struktur Data Shift & Mutasi Kas
```json
{
  "shift_id": "shf_20260926_morn_01",
  "attendant_id": "att_budi_08",
  "supervisor_id": "spv_hendra_02",
  "zone_id": "zone_ruko_a",
  "start_time": "2026-09-26T06:00:00+07:00",
  "end_time": "2026-09-26T14:00:00+07:00",
  "cash_float_start": 100000.0,
  "cash_collected_system": 450000.0,
  "qris_collected_system": 180000.0,
  "actual_cash_counted": 550000.0,
  "cash_variance": 0.0,
  "active_vehicles_handed_over": 14,
  "status": "CLOSED"
}
```

---

### 3. Rumus Rekonsiliasi Kas
$$\text{Ekspektasi Kas Fisik} = \text{Modal Awal (Cash Float)} + \text{Total Penerimaan Tunai} - \text{Pengeluaran Kas yang Disetujui}$$
$$\text{Selisih Kas (Variance)} = \text{Kas Fisik Dihitung} - \text{Ekspektasi Kas Fisik}$$

- **Variance = 0**: Kas Seimbang (*Balanced*).
- **Variance > 0**: Kas Lebih (*Overage* / Kelebihan Uang).
- **Variance < 0**: Kas Kurang (*Shortage* / Uang Hilang).
- Setiap selisih (positif atau negatif) wajib menyertakan formulir keterangan alasan dan eskalasi ke supervisor.

---

### 4. Serah Terima Kendaraan Aktif (Inventory Handover)
Saat juru parkir shift pagi digantikan oleh shift sore:
- Sistem menampilkan daftar kendaraan yang masih berada di slot (*active parked vehicles*).
- Juru parkir shift baru melakukan konfirmasi bersama (joint sign-off) bahwa 14 kendaraan tersebut secara fisik memang ada di slot yang sesuai.
- Menghindari juru parkir baru disalahkan atas kendaraan yang hilang atau rusak dari shift sebelumnya.
