# Incident Management Specification (INCIDENT.md)
## Pelaporan Kerusakan, Kehilangan, Konflik, & Kendaraan Tertahan

---

### 1. Taksonomi Insiden Lapangan
Aplikasi membagi insiden parkir menjadi 5 kategori standar:

| Kategori Insiden | Kode | Deskripsi Contoh | Bukti Wajib |
| :--- | :--- | :--- | :--- |
| **Kerusakan Kendaraan** | `VEHICLE_DAMAGE` | Motor jatuh tertiup angin, tersenggol motor lain, spion patah, baret pintu mobil. | Foto detail kerusakan, foto posisi slot sekitar. |
| **Klaim Kehilangan Barang**| `PROPERTY_LOSS` | Pemilik mengaku helm hilang, jaket hilang, barang belanjaan di bagasi luar hilang. | Foto check-in awal (observasi barang), foto motor saat checkout. |
| **Dispute / Konflik Konsumen**| `DISPUTE_ALTERCATION` | Konsumen menolak membayar tarif, adu mulut durasi, klaim waktu salah. | Catatan kronologi, data log check-in/out. |
| **Kendaraan Mogok / Terhalang**| `IMMOBILIZED_VEHICLE` | Kunci kontak patah/hilang, ban kempes, mobil terhalang mobil lain yang rem tangan aktif. | Foto posisi slot, nomor kontak pemilik jika ada. |
| **Penerobosan Gerbang** | `GATE_RUNNER` | Pengendara kabur menerobos tanpa membayar tarif parkir. | Foto plat nomor (bila sempat), catatan jam kejadian. |

---

### 2. Alur Pelaporan Insiden (Incident Report Flow)
```
[ Juru Parkir / Supervisor Klik "Laporkan Insiden" ]
                         │
                         ▼
[ Pilih Kategori Insiden & Hubungkan ke Sesi Parkir (Jika Relevan) ]
                         │
                         ▼
[ Ambil Foto Bukti Insiden (Minimal 1 Foto, Maksimal 5 Foto) ]
                         │
                         ▼
[ Tulis Kronologi Singkat Kejadian & Pihak Terlibat ]
                         │
                         ▼
[ Tindakan Cepat Diambil (Misal: Dipindahkan, Dilaporkan ke Polsek) ]
                         │
                         ▼
[ Simpan & Berikan Tanda Terima Laporan / Tiket Kasus ]
                         │
                         ▼
[ Sistem Mengunci Sesi Parkir dari Auto-Purge Data Retention ]
```

---

### 3. Skema Data Insiden
```json
{
  "incident_id": "inc_20260926_001",
  "facility_id": "fac_fatmawati_01",
  "session_id": "ses_01J9X8K4N2P3Q5R6S7T8U9V0W1",
  "category": "VEHICLE_DAMAGE",
  "severity": "MEDIUM",
  "reported_at": "2026-09-26T11:20:00+07:00",
  "attendant_id": "att_budi_08",
  "supervisor_id": "spv_hendra_02",
  "description": "Standar samping ambles di tanah lunak, motor Honda Beat B 4821 SSG miring dan menimpa knalpot motor sebelah. Spion kanan retak.",
  "photo_evidence_ids": [
    "evi_inc_001_detail",
    "evi_inc_002_slot"
  ],
  "resolution_status": "OPEN",
  "police_report_number": null,
  "freeze_retention": true
}
```

---

### 4. Proteksi Retensi Data untuk Kasus Aktif
Sesuai **ADR-004**, sesi yang berstatus `freeze_retention: true` tidak akan pernah dihapus oleh cron-job retensi 30 hari hingga status penyelesaian insiden diubah menjadi `RESOLVED_CLOSED` oleh Manajer Operasional.
