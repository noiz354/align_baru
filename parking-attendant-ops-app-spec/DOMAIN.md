# Domain Model & Ubiquitous Language (DOMAIN.md)

---

### 1. Ubiquitous Language (Glosarium Domain Parkir)
- **Parking Zone (Zona Parkir)**: Pembagian area geografis utama (contoh: Area Depan, Basement, Sayap Kiri, Ruko Utara).
- **Parking Slot (Slot Parkir)**: Petak fisik terkecil tempat 1 kendaraan diletakkan (contoh: Slot M-01 untuk Motor, C-05 untuk Mobil).
- **Slot Status**: Status keterisian slot:
  - `EMPTY`: Slot bebas dan siap dialokasikan.
  - `OCCUPIED`: Slot sedang terisi oleh kendaraan dengan sesi aktif.
  - `RESERVED`: Slot direservasi untuk staf, tamu khusus, atau difabel.
  - `BLOCKED`: Slot ditutup sementara karena genangan, proyek, atau motor roboh.
- **Parking Session (Sesi Parkir)**: Siklus hidup kendaraan sejak check-in tercatat sampai check-out lunas.
- **Plate Number (Plat Nomor)**: Nomor registrasi kendaraan bermotor (contoh: `B 1234 ABC`).
- **Vehicle Type**: Kategori dimensi kendaraan (`MOTORCYCLE`, `CAR`, `BICYCLE`, `TRUCK_HEAVY`).
- **Observed Visible Items**: Observasi visual atas barang yang terlihat ditinggalkan pada kendaraan (helm, jaket, barang bagasi terbuka) tanpa pengakuan hak milik formal.
- **Relocation / Move Vehicle**: Proses memindahkan kendaraan yang sedang parkir dari Slot Asal ke Slot Tujuan oleh juru parkir untuk merapikan barisan.
- **Mismatch Alert**: Peringatan anomali saat checkout di mana plat, tipe kendaraan, atau ciri fisik tidak sesuai dengan catatan check-in awal.
- **Overstay**: Kondisi kendaraan melebihi ambang batas durasi wajar operasional (misal: > 12 jam atau menginap semalam).
- **Lost Ticket (Tiket Hilang)**: Kondisi pelanggan tidak memegang tiket fisik/QR asli, memerlukan verifikasi identitas STNK dan KTP.
- **Shift**: Satuan tugas kerja juru parkir dalam periode waktu tertentu (termasuk modal kas awal dan inventaris kendaraan aktif).
- **Cash Reconciliation**: Proses perhitungan uang fisik yang dikumpulkan juru parkir dibandingkan dengan total kalkulasi penerimaan sistem.
- **Incident Report**: Berkas dokumentasi tertulis dan visual atas kecelakaan, gesekan, motor roboh, atau perselisihan di area parkir.

---

### 2. Diagram Hubungan Entitas Domain (Entity Relationship)

```
+--------------------------------------------------------------------------+
|                             PARKING LOT                                  |
|   - id: String                                                           |
|   - name: String                                                         |
|   - total_capacity: Integer                                              |
+--------------------------------------------------------------------------+
          │ 1
          │ memiliki banyak (1..*)
          ▼
+--------------------------------------------------------------------------+
|                             PARKING ZONE                                 |
|   - id: String                                                           |
|   - name: String (e.g., "Zona Depan", "Basement B1")                     |
+--------------------------------------------------------------------------+
          │ 1
          │ memiliki banyak (1..*)
          ▼
+--------------------------------------------------------------------------+
|                             PARKING SLOT                                 |
|   - id: String                                                           |
|   - slot_code: String (e.g., "M-01", "C-12")                             |
|   - vehicle_type_allowed: VehicleType                                    |
|   - status: SlotStatus (EMPTY | OCCUPIED | RESERVED | BLOCKED)           |
|   - current_session_id: Optional[String]                                 |
+--------------------------------------------------------------------------+
          │ 1
          │ ditempati oleh (0..1)
          ▼
+--------------------------------------------------------------------------+
|                            PARKING SESSION                               |
|   - id: String                                                           |
|   - vehicle_id: String                                                   |
|   - slot_id: String                                                      |
|   - check_in_time: SystemTimestamp (RFC3339)                             |
|   - check_out_time: Optional[SystemTimestamp]                            |
|   - state: SessionState (ACTIVE | CHECKED_OUT | OVERSTAY | CANCELLED)     |
|   - check_in_attendant_id: String                                        |
|   - check_out_attendant_id: Optional[String]                             |
|   - shift_id: String                                                     |
|   - initial_condition_notes: String                                      |
|   - observed_items: List[ObservedItem]                                   |
|   - pricing_breakdown: Optional[PricingBreakdown]                        |
|   - payment_status: PaymentStatus (UNPAID | PAID | OVERRIDE_WAIVED)       |
+--------------------------------------------------------------------------+
       │ 1                           │ 1                           │ 1
       │ memiliki (1..*)             │ mengalami (0..*)            │ dilaporkan (0..*)
       ▼                             ▼                             ▼
+-----------------------+     +----------------------+     +---------------------+
|    PHOTO EVIDENCE     |     |   RELOCATION LOG     |     |   INCIDENT RECORD   |
| - id: String          |     | - id: String         |     | - id: String        |
| - session_id: String  |     | - session_id: String |     | - session_id: String|
| - capture_time: Time  |     | - from_slot: String  |     | - incident_type: ...|
| - perspective: Enum   |     | - to_slot: String    |     | - attendant_id: ... |
| - file_path: String   |     | - moved_at: Time     |     | - description: String|
| - hash_sha256: String |     | - attendant_id: ...  |     | - photos: List[Id]  |
| - is_retained: Bool   |     | - reason: String     |     | - supervisor_sig: ..|
+-----------------------+     +----------------------+     +---------------------+
```

---

### 3. State Transition: Siklus Hidup Sesi Parkir (Session Lifecycle)
```
          [ Check-In Diinisiasi ]
                    │
                    ▼
               ( ACTIVE ) ────[ Pindah Slot ]────> ( ACTIVE )
                    │                                (Relocation logged)
                    │ (Durasi > Threshold)
                    ▼
               ( OVERSTAY )
                    │
                    │ [ Check-Out Triggered ]
                    ▼
          [ Verifikasi & Hitung Tarif ]
                    │
                    ├──[ Mismatch Ditemukan ]──> ( UNDER_INVESTIGATION )
                    │
                    ▼
          [ Pembayaran Lunas / Override ]
                    │
                    ▼
             ( CHECKED_OUT )
                    │
                    ▼
          [ Pembebasan Slot (EMPTY) ]
```
