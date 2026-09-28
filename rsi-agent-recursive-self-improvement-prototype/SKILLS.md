# AI Skills & Operational Playbooks (SKILLS.md)
## Keterampilan Teknis & Prosedur Eksekusi Terstruktur

Dokumen ini adalah inventaris kapabilitas domain, bukan daftar skill agent. Setiap entri
mengarang fungsi yang benar-benar ada di `rsi/` — nama fungsi di bawah dapat diverifikasi dengan
`grep "def <nama>" rsi/<modul>.py`.

---

### Skill 1: `get_jev`
- **Tujuan**: Memilih kandidat langkah berdasarkan expected value (Jensen-Shannon
  expected value) agar routing keputusan bisa diaudit dan bukan sekadar tebakan.
- **Modul**: `rsi/jev.py`
- **Aturan**:
  1. `_softmax` menormalkan skor kandidat menjadi distribusi probabilitas.
  2. Nilai JEV dihitung dari nilai kesehatan tiap kandidat, bukan dari urutan deklarasi.
  3. Kandidat bernilai rendah tetap dapat dipilih secara eksplisit, dan alasannya tercatat di audit.

---

### Skill 2: `classify_risk`
- **Tujuan**: Menentukan apakah sebuah path layak diedit otomatis atau harus lewat persetujuan manusia.
- **Modul**: `rsi/risk.py`
- **Aturan**:
  1. `_normalize_path` merapikan path lebih dulu agar perbandingan tidak bergantung pada DFS atau symlink.
  2. `is_restricted_path` menandai area yang tidak boleh disentuh (`.git`, cache, `runs/`).
  3. `is_self_editable_path` menandai file yang memang menjadi target improvement, sehingga boleh diedit.
  4. Klasifikasi akhir menentukan apakah sebuah proposal otomatis atau butuh approval.

---

### Skill 3: `assert_no_secrets` / `find_secret` / `redact`
- **Tujuan**: Mencegah kredensial masuk ke patch, log, atau artefak yang dipublikasikan.
- **Modul**: `rsi/sandbox.py`
- **Aturan**:
  1. `find_secret` mendeteksi pola rahasia pada teks sebelum patch diterapkan.
  2. `redact` mengganti nilai yang terdeteksi sehingga artefak tetap berguna tanpa membocorkan.
  3. `assert_no_secrets` adalah gerbang yang menghentikan proses bila pemeriksaan gagal.

---

### Skill 4: `unified_diff` / `diff_line_count`
- **Tujuan**: Mengukur perubahan secara deterministik sehingga tidak ada diff tak terbatas yang lolos.
- **Modul**: `rsi/sandbox.py`
- **Aturan**:
  1. `unified_diff` menghasilkan diff yang stabil, sehingga dua run dapat dibandingkan.
  2. `diff_line_count` dipakai sebagai batas ukuran proposal.

---

### Skill 5: `content_revision` / `canonical_json`
- **Tujuan**: Memberi setiap revisi memori identitas yang bisa dibandingkan antar run.
- **Modul**: `rsi/memory.py`
- **Aturan**:
  1. `canonical_json` menormalkan serialisasi agar key order tidak memengaruhi identitas.
  2. `content_revision` menaikkan revisi hanya bila isi benar-benar berubah.

---

### Skill 6: `run_benchmark` / `compare_snapshots` / `comparability`
- **Tujuan**: Membuktikan bahwa sebuah perubahan memperbaiki, bukan hanya mengubah.
- **Modul**: `rsi/benchmark.py`
- **Aturan**:
  1. `run_benchmark` menjalankan skenario tetap dan menyimpan snapshot.
  2. `comparability` menolak membandingkan dua snapshot yang konfigurasinya tidak sama.
  3. `compare_snapshots` baru menghasilkan verdict bila `comparability` benar.

---

### Skill 7: `detect_hazard`
- **Tujuan**: Mengubah kegagalan yang sudah terjadi menjadi sinyal yang bisa ditindaklanjuti.
- **Modul**: `rsi/feedback.py`
- **Aturan**:
  1. Pola kegagalan diklasifikasi dari artefak run, bukan dari asumsi.
  2. Temuan harus dapat ditelusuri ke evidence yang menghasilkan temuan itu.

---

### Skill 8: `compute_loop_health`
- **Tujuan**: Mengukur apakah loop perbaikan sedang membaik, stagnan, atau memburuk.
- **Modul**: `rsi/metrics.py`
- **Aturan**:
  1. `_median` dipakai sebagai ukuran tengah agar satu run ekstrem tidak mendominasi.
  2. `compute_loop_health` menggabungkan metrik menjadi satu verdict.
  3. Verdict menjadi input keputusan improvement, bukan angka untuk dipamerkan.

---

### Skill 9: `deterministic_proposal_id`
- **Tujuan**: Menjamin proposal yang sama selalu memiliki identitas yang sama.
- **Modul**: `rsi/proposals.py`
- **Aturan**:
  1. ID dihitung dari isi proposal, bukan dari urutan atau timestamp.
  2. Proposal duplikat terdeteksi sebagai duplikat, bukan sebagai proposal baru.

---

### Skill 10: `export_skills` / `render_skill_markdown` / `skill_stats`
- **Tujuan**: Mengekspor kapabilitas yang dipelajari menjadi SKILLS.md yang bisa dibaca manusia.
- **Modul**: `rsi/skills.py`
- **Aturan**:
  1. `skill_stats` menghitung distribusi kapabilitas sebelum ekspor.
  2. `render_skill_markdown` menghasilkan keluaran yang bisa dibaca manusia.
  3. `export_skills` menulis keluaran ke lokasi yang ditentukan CLI.

---

### Skill 11: `stable_seed` / `new_id`
- **Tujuan**: Membuat run yang dapat direproduksi.
- **Modul**: `rsi/types.py`
- **Aturan**:
  1. `stable_seed` menurunkan seed yang sama dari input yang sama.
  2. `new_id` hanya dipakai untuk identitas yang memang tidak boleh berulang.

---

## Gate dan Perintah

| Layer | Perintah | Kebutuhan |
|---|---|---|
| Test | `python3 -m unittest discover -s tests -v` | tidak ada — stdlib saja |
| Demo | `python3 demo.py --waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4` | tidak ada |
| Demo penuh | `python3 demo.py --waves 2 --tasks-per-wave 6 --drs-rounds 2 --drs-tasks 4 --holdout 12` | tidak ada |
| Loop perbaikan | `python3 demo.py --improve --max-cycles 2 --max-lessons 2 --auto-approve` | Hati-hati — `--auto-approve` melewati persetujuan manusia |
| CLI | `python3 -m rsi.cli run --improve`, `status`, `audit --verify` | tidak ada |

Artefak ditulis ke `runs/` (report.md, memory.json, attempts.jsonl, audit.jsonl, cycles.json,
dashboard.html). `runs/` bersifat regenerable dan tidak boleh di-commit sebagai bukti.

> Catatan kejujuran: 5 file test berisi 142 test case. Angka "5" adalah jumlah file, bukan
> jumlah test — bedakan keduanya saat melaporkan hasil.
