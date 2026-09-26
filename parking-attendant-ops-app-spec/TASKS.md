# Engineering Task Breakdown (TASKS.md)
## Rincian Tiket Teknis & Backlog Pekerjaan

---

### Epic 1: Domain Core & Local Persistence
- **TASK-101**: Setup arsitektur folder, domain interfaces, dan entitas inti Python/TypeScript.
- **TASK-102**: Definisikan schema database SQLite untuk `zones`, `slots`, `sessions`, `photos`, `shifts`, `incidents`, dan `audit_logs`.
- **TASK-103**: Buat migration runner dan transactional wrapper untuk database lokal.

### Epic 2: Parking Slot & Relocation Management
- **TASK-201**: Implementasi state machine slot (`EMPTY`, `OCCUPIED`, `RESERVED`, `BLOCKED`).
- **TASK-202**: Buat query pencarian slot kosong terdekat berdasarkan tipe kendaraan.
- **TASK-203**: Implementasi use case `MoveVehicleUseCase` dengan pencatatan audit asal, tujuan, dan alasan.

### Epic 3: Check-In Workflow & Visual Evidence
- **TASK-301**: Implementasi normalisasi dan sanitasi plat nomor Indonesia (`PlateSanitizer`).
- **TASK-302**: Buat service enkapsulasi bukti foto (`PhotoEvidenceService`) dengan hashing SHA-256 dan burn-in metadata.
- **TASK-303**: Buat form observasi barang tertinggal dengan tag visual cepat (helm, jaket, tas).
- **TASK-304**: Integrasikan penerbitan tiket QR payload dan builder ESC/POS thermal printing.

### Epic 4: Pricing Engine & Check-Out
- **TASK-401**: Implementasi `PricingEngine` dengan dukungan Grace Period, Tarif Jam Pertama, Jam Berikutnya, dan Cap Harian.
- **TASK-402**: Implementasi use case `CheckOutUseCase` dengan validasi Monotonic Timestamp anti-tampering.
- **TASK-403**: Buat alur deteksi mismatch kendaraan masuk vs keluar.
- **TASK-404**: Implementasi use case tiket hilang (`LostTicketVerificationUseCase`) dengan denda dan otorisasi PIN.

### Epic 5: Shift, Cash Reconciliation, & Incident
- **TASK-501**: Implementasi siklus buka shift (`open_shift`) dengan pencatatan kas awal.
- **TASK-502**: Implementasi serah terima kendaraan aktif (*inventory handover*) antar shift.
- **TASK-503**: Implementasi kalkulasi selisih kas (*cash variance*) saat penutupan shift.
- **TASK-504**: Buat modul pelaporan insiden (`IncidentReportService`) dengan linking ke sesi parkir dan foto bukti kerusakan.

### Epic 6: Security, Privacy, & Audit
- **TASK-601**: Implementasi immutable append-only JSON audit logger.
- **TASK-602**: Buat service penyamaran plat nomor (*PlateMaskingService*) dan retensi pembersihan berkas 30 hari.
