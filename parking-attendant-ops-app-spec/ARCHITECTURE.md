# System Architecture Document (ARCHITECTURE.md)

---

### 1. Pola Arsitektur (Architectural Pattern)
Sistem menggunakan pendekatan **Local-First / Offline-First Domain-Driven Hexagonal Architecture (Ports and Adapters)**. Hal ini memastikan logika inti parkir, kalkulasi tarif, pencatatan bukti foto, dan shift dapat dieksekusi secara instan di perangkat juru parkir (Edge Device), dengan kemampuan replikasi asinkron ke server pusat (*Sync Engine*).

```
+-------------------------------------------------------------------------------+
|                             CLIENT APPLICATION LAYER                          |
|  +-------------------------------------------------------------------------+  |
|  |                       UI / CLI Presentation Layer                       |  |
|  |    - Check-in Controller               - Shift & Cash Controller        |  |
|  |    - Check-out & Mismatch UI           - Incident & Relocation View     |  |
|  +-------------------------------------------------------------------------+  |
|                                       │                                       |
|                                       ▼                                       |
|  +-------------------------------------------------------------------------+  |
|  |                       APPLICATION SERVICE LAYER                         |  |
|  |    - CheckInUseCase                    - CheckOutUseCase                |  |
|  |    - MoveVehicleUseCase                - SettleShiftUseCase             |  |
|  |    - ReportIncidentUseCase             - PricingCalculationEngine       |  |
|  +-------------------------------------------------------------------------+  |
|                                       │                                       |
|                                       ▼                                       |
|  +-------------------------------------------------------------------------+  |
|  |                         DOMAIN CORE LAYER                               |  |
|  |    - Entities: Vehicle, Slot, Session, Shift, Incident, PhotoEvidence   |  |
|  |    - Value Objects: PlateNumber, Money, GeoPoint, TimeRange, RateTier   |  |
|  |    - Domain Events: VehicleCheckedIn, VehicleMoved, VehicleCheckedOut   |  |
|  +-------------------------------------------------------------------------+  |
|                                       │                                       |
|        ┌──────────────────────────────┴──────────────────────────────┐        |
|        ▼                                                             ▼        |
|  +---------------------------+                         +-------------------+  |
|  |   OUTBOUND PORTS          |                         |  INBOUND PORTS    |  |
|  |   - IParkingRepository    |                         |  - ICheckInApi    |  |
|  |   - IPhotoStoragePort     |                         |  - ICheckOutApi   |  |
|  |   - IAuditLogPort         |                         |  - IShiftApi      |  |
|  |   - ISyncEnginePort       |                         |  - IOcrEnginePort |  |
|  +---------------------------+                         +-------------------+  |
+-------------------------------------------------------------------------------+
                                        │
                                        ▼
+-------------------------------------------------------------------------------+
|                            INFRASTRUCTURE LAYER                               |
|  - SQLite / Encrypted SQLCipher (Local Embedded Database)                     |
|  - File-based Local Encrypted Media Store (Photos)                            |
|  - Hardware Driver: ESC/POS Thermal Printer Driver, Camera HAL                |
|  - Outbox Sync Worker (HTTP/gRPC TLS 1.3 Sync to Cloud Hub)                   |
|  - JSON Audit Append-Only Immutable Ledger                                    |
+-------------------------------------------------------------------------------+
```

---

### 2. Dekomposisi Modul
1. **Module Parking (Titik & Zona)**: Pengelolaan hierarki Zona -> Area -> Slot -> Status Lifecycle.
2. **Module Vehicle (Identitas Kendaraan)**: Validasi plat nomor, klasifikasi tipe (Motor, Mobil, Sepeda, Truk), warna, dan status pengawasan (Watchlist).
3. **Module CheckIn**: Orkestrasi foto awal, observasi kelengkapan, pengalokasian slot terdekat, timestamping, dan penerbitan tiket QR.
4. **Module CheckOut**: Scanning, mismatch verification, trigger pricing engine, payment recording, dan pembebasan slot (*release to EMPTY*).
5. **Module Pricing**: Evaluasi skema tarif (flat, hourly, progressive, night, event, lost ticket fee) secara murni berbasis timestamp sistem.
6. **Module Photo Evidence**: Metadata binding (GPS, Attendant, Direction, Timestamp), kompresi lokal, watermark bukti hukum, dan retention management.
7. **Module Shift & Cash**: Sesi juru parkir, kas pembukaan (*float*), tracking mutasi kas, serah terima sisa unit di lapangan, dan rekonsiliasi kas penutupan.
8. **Module Incident**: Formulir laporan insiden lapangan terstandar (kerusakan, benturan, kehilangan helm, dispute).
9. **Module Audit**: Immutable append-only audit trail logging setiap perubahan status dan override.
10. **Module Offline / Sync**: Transactional outbox pattern dengan conflict resolution rule: *Last-Write-Wins with Domain Invariant Checks*.

---

### 3. Komponen Data & Storage Strategy
- **Client Storage**: SQLite (atau SQLite via Room / CoreData / SQLCipher).
- **Blob Storage (Foto)**: Direktori lokal terenkripsi `/data/evidence/YYYY/MM/DD/{session_id}/`, thumbnail dibuat instan untuk render UI cepat.
- **Data Lifecycle**:
  - Sesi aktif (Active Session): Cached di memori + persisted di DB lokal.
  - Selesai (Completed): Tertahan di lokal selama 7 hari sebelum dipindahkan atau di-purge jika sync sudah terkonfirmasi (*ACK-ed* oleh server).

---

### 4. Strategi Toleransi Kesalahan (Fault Tolerance)
- **Zero Network Dependency for Operations**: Operasi check-in dan checkout tidak pernah menunggu respon jaringan remote. Semua request ditulis ke Local DB + Outbox Queue.
- **Crash Recovery**: State mesin parkir disimpan atomik. Jika ponsel juru parkir mati mendadak (kehabisan baterai), sesi parkir aktif dan mutasi shift pulih seketika saat restart.
- **Clock Tampering Protection**: Menghindari juru parkir memundurkan jam HP untuk memotong tarif; aplikasi mengunci selisih waktu relatif (*Monotonic Boot Time Clock* + NTP delta verification).
