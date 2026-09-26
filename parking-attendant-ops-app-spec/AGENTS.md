# Autonomous AI Agents Specification (AGENTS.md)
## Peran & Tanggung Jawab Tim Agent AI

Dalam pengembangan dan pemeliharaan aplikasi operasional juru parkir ini, interaksi rekayasa perangkat lunak dibagi ke dalam beberapa AI Agent terspesialisasi:

---

### 1. Agent: `DomainArchitect`
- **Tanggung Jawab**: Menjaga integritas model domain (*Domain Invariants*), memastikan pemisahan ketat antara business logic dan framework I/O, serta memvalidasi kesesuaian dengan Ubiquitous Language.
- **Batasan**: Tidak menulis kode infrastruktur database mentah; hanya merancang interface, entitas, dan use cases.

### 2. Agent: `FieldErgonomicsSpecialist`
- **Tanggung Jawab**: Mendesain alur interaksi antarmuka pengguna (UI/UX) khusus juru parkir di lapangan terbuka. Menjamin pengoperasian satu tangan, kontras outdoor tinggi, ukuran touch-target ramah jempol, serta audio/haptic feedback.
- **Keluaran**: Komponen UI, wireframe layout, micro-copywriting pencegah salah paham hukum barang titipan.

### 3. Agent: `PricingAndFinanceAuditor`
- **Tanggung Jawab**: Menjamin ketepatan algoritma kalkulasi tarif (Grace period, progressive, daily max cap, denda) dan integritas rekonsiliasi kas shift.
- **Fokus Pengujian**: Edge cases seperti parkir 0 detik, parkir melintasi tengah malam, jam mundur buatan, dan selisih kas fisik.

### 4. Agent: `EvidenceAndForensicsAgent`
- **Tanggung Jawab**: Memastikan setiap bukti foto memiliki validitas hukum yang kuat (kriptografi SHA-256, burn-in watermark waktu & juru parkir, koordinat GPS).
- **Fokus Hukum**: Menjaga agar observasi barang tertinggal tidak menjadi klausul penitipan barang yang memberatkan pengelola.

### 5. Agent: `PrivacyAndSecurityGuardian`
- **Tanggung Jawab**: Menegakkan kepatuhan UU PDP / GDPR, mengaudit akses plat nomor, menjalankan script retensi pembersihan data 30 hari, serta menerapkan proteksi anti-tampering clock sistem.
