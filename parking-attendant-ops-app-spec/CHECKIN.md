# Check-In Workflow Specification (CHECKIN.md)
## Alur Masuk Kendaraan, Observasi Kondisi, & Tiket QR

---

### 1. Tujuan & SLA (Service Level Agreement)
- **Target Waktu**: Maksimal **10 detik** dari kendaraan berhenti hingga tiket tercetak atau tersimpan di sistem.
- **Prinsip Operasional**: Kecepatan adalah kunci agar tidak menimbulkan kemacetan di mulut gerbang atau akses jalan raya.

---

### 2. Diagram Alur Check-In Lengkap
```
+--------------------------------------------------------------------------+
|                      LANGKAH 1: IDENTIFIKASI AWAL                        |
| - Arahkan kamera ke plat nomor kendaraan                                 |
| - Scan/OCR otomatis mendeteksi plat ATAU Attendant ketik manual          |
| - Sistem memilih jenis kendaraan default (misal: MOTORCYCLE)             |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                 LANGKAH 2: FOTO KONDISI & OBSERVASI BARANG               |
| - Ambil foto cepat 1 (Tampak Keseluruhan / Plat & Bodi)                  |
| - Opsi foto 2 (Kondisi baret/pecah jika ada)                             |
| - Tap observasi barang cepat: [Helm: 1/2], [Tas/Paket], [Spion Utuh]    |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                    LANGKAH 3: ASSIGN SLOT PARKIR                         |
| - Sistem merekomendasikan slot kosong terdekat                           |
| - Attendant tap konfirmasi slot (misal: "M-04")                          |
+--------------------------------------------------------------------------+
                                     │
                                     ▼
+--------------------------------------------------------------------------+
|                 LANGKAH 4: COMMIT TRANSAKSI & TIKET                      |
| - Generate UUID sesi & Timestamp Sistem (RFC3339)                        |
| - Update status slot menjadi OCCUPIED                                    |
| - Generate Tiket QR (bisa dicetak via printer thermal BLE atau digital)  |
| - Broadcast event 'VehicleCheckedIn' ke Local Store & Outbox Table       |
+--------------------------------------------------------------------------+
```

---

### 3. Struktur Data Payload Check-In
```json
{
  "session_id": "ses_01J9X8K4N2P3Q5R6S7T8U9V0W1",
  "facility_id": "fac_fatmawati_01",
  "zone_id": "zone_front_a",
  "slot_id": "slot_m_04",
  "vehicle": {
    "plate_number": "B 4821 SSG",
    "type": "MOTORCYCLE",
    "color": "BLACK",
    "direction": "NOSE_IN"
  },
  "condition_evidence": {
    "primary_photo_path": "/evidence/2026/09/26/ses_01J9X..._front.jpg",
    "photo_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "visual_notes": "Baret tipis spakbor kiri",
    "observed_items": [
      { "item_type": "HELMET", "count": 2, "location": "MIRROR_HANG" },
      { "item_type": "PACKAGE", "count": 1, "location": "FLOORBOARD" }
    ]
  },
  "check_in_time": "2026-09-26T09:15:30.123+07:00",
  "attendant_id": "att_budi_08",
  "shift_id": "shf_morning_20260926"
}
```

---

### 4. Format Tiket Fisik / QR
Tiket fisik dicetak pada kertas thermal 58mm dengan isi:
```
================================
  KANTUNG PARKIR PASAR BARU
       OPERATOR RESMI
================================
TIKET: #B4821-0915
PLAT : B 4821 SSG
TIPE : MOTOR
SLOT : A-04 (Depan)
JAM  : 26/09/2026 09:15 WIB
PETUGAS: BUDI (Shift Pagi)
--------------------------------
[      QR-CODE MATRIX          ]
  ses_01J9X8K4N2P3Q5R6S7T8U9V0W1
--------------------------------
Simpan tiket ini untuk checkout.
Barang berharga harap dibawa.
Observasi masuk: Helm (2), Paket (1).
================================
```
