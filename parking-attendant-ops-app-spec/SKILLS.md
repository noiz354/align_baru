# AI Skills & Operational Playbooks (SKILLS.md)
## Keterampilan Teknis & Prosedur Eksekusi Terstruktur

---

### Skill 1: `validate_indonesian_plate`
- **Tujuan**: Memvalidasi dan membersihkan input plat nomor acak menjadi format kanonikal dan format tampilan Indonesia standar.
- **Input**: `raw_text: str` (contoh: "b-1234.abc", "D 999 Z", "BK8812TAA")
- **Aturan**:
  1. Hapus simbol selain huruf dan angka.
  2. Pisahkan komponen kode wilayah, angka registrasi, dan kode akhir.
  3. Kembalikan format display `[KODE] [NOMOR] [SERI]` dan canonical `[KODE][NOMOR][SERI]`.

---

### Skill 2: `compute_session_pricing`
- **Tujuan**: Menghitung biaya parkir secara deterministik murni berbasis selisih timestamp sistem.
- **Input**:
  - `check_in_time: str` (ISO8601/RFC3339)
  - `check_out_time: str` (ISO8601/RFC3339)
  - `vehicle_type: str`
  - `rate_rule: dict`
  - `flags: { is_lost_ticket: bool, is_waived: bool }`
- **Aturan**:
  - Terapkan Grace Period (jika durasi <= ambang batas, biaya = 0).
  - Terapkan pembulatan jam ke atas.
  - Terapkan batas maksimum 24 jam (*Daily Cap*).
  - Tambahkan denda jika tiket hilang.

---

### Skill 3: `reconcile_shift_cash`
- **Tujuan**: Melakukan audit perhitungan uang tunai saat pergantian giliran kerja juru parkir.
- **Input**:
  - `cash_float_start: float`
  - `cash_collections_sum: float`
  - `approved_cash_expenses: float`
  - `physical_cash_counted: float`
- **Aturan**:
  - `expected_cash = cash_float_start + cash_collections_sum - approved_cash_expenses`
  - `variance = physical_cash_counted - expected_cash`
  - Tandai status: `BALANCED`, `SHORTAGE` (kurang), atau `OVERAGE` (lebih).

---

### Skill 4: `generate_evidence_hash_envelope`
- **Tujuan**: Mengunci integritas bukti foto kondisi awal kendaraan agar tidak dapat dimanipulasi.
- **Input**:
  - `photo_bytes: bytes`
  - `session_id: str`
  - `attendant_id: str`
  - `system_time: str`
- **Aturan**:
  - Hitung SHA-256 dari `photo_bytes`.
  - Buat struktur envelope terverifikasi dengan payload audit untuk disimpan ke tabel bukti foto.
