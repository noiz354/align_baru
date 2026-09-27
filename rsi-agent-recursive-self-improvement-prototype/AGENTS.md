# Autonomous AI Agents Specification (AGENTS.md)

## Peran & Tanggung Jawab Tim Agent AI

Dalam pengembangan prototipe RSI (Recursive Self-Improvement) ini, kerja rekayasa
dibagi ke dalam agent terspesialisasi yang sejajar dengan arsitektur loop:

---

### 1. Agent: `CurriculumAgent`
- **Tanggung Jawab**: Mengusulkan task eksplorasi — `propose_broad` (BRS, cakupan
  luas) dan `propose_deep` (DRS, menarget knowledge key terlemah dari lesson
  bertipe `boundary`).
- **Batasan**: Tidak mengeksekusi task, tidak menulis memory langsung; hanya
  mengusulkan. Saat test-time (holdout) agent ini nonaktif.

### 2. Agent: `ActorAgent`
- **Tanggung Jawab**: Menjalankan tiap task lewat `ReActHarness`
  (Context → LLM → Tool → Memory → loop) dengan routing Jev
  (`fast_model` / `deep_model` / `human`).
- **Batasan**: Tidak menilai hasilnya sendiri; verdict milik `VerifierAgent`.

### 3. Agent: `VerifierAgent`
- **Tanggung Jawab**: Menilai attempt lewat Jev (`score` + `done`), mengekstrak
  lesson terverifikasi (prosedur + boundary condition) ke persistent memory.
- **Prinsip**: Tidak mempercayai klaim Actor — verdict berasal dari eksekusi
  nyata (checks + output). Lesson dari kegagalan (boundary) adalah bahan bakar DRS.

### 4. Agent: `JevOracle`
- **Tanggung Jawab**: Menjawab typed questions — guardrail (`Noul`), routing
  (`Choice`), grading (`Score`), done-check (`Noul`). Mock (`MockJev`)
  deterministik untuk offline; `TypeSafeJev` untuk semantik asli.
- **Batasan**: Tidak menulis kode, hanya mengembalikan keputusan terstruktur.

### 5. Agent: `MemoryKeeper`
- **Tanggung Jawab**: Menjaga `PersistentMemory` — lesson selalu `verified=True`
  (diamati terhadap eksekusi), freeze memblokir write (`MemoryFrozenError`),
  resume mengarsipkan memory lama ke `memory.prev.json` agar tidak warm-start bocor.

### 6. Agent: `ImprovementLoop` (v0.2)
- **Tanggung Jawab**: Menjalankan bounded self-improvement atas memory:
  evidence → `ImprovementProposal` → kandidat terisolasi (`CandidateWorkspace`)
  → evaluasi baseline-vs-candidate → accept/reject/escalate → apply →
  verifikasi → rollback. Iterasi dibatasi `ImprovementLimits`; keputusan tercatat
  di hash-chained `audit.jsonl`; proposal HIGH/CRITICAL wajib human approval.
- **Batasan**: Hanya mengubah `runs/memory.json` (dan regen `SKILL.md`/`CLAUDE.md`;
  file lain — `rsi/`, `tests/`, `SECURITY.md`, dll — protected path, CRITICAL,
  tidak pernah auto-applied).

---

## Cara menjalankan

```bash
python3 demo.py                              # run offline penuh (mock LLM + mock Jev)
python3 demo.py --improve --max-cycles 2     # + bounded improvement loop
python3 demo.py --resume                     # lanjut dari runs/memory.json yang ada
python3 demo.py --backend openai             # actor LLM nyata (OPENAI_API_KEY)
python3 demo.py --jev typesafe               # judge Jev nyata (TYPESAFE_API_KEY)
python3 -m unittest discover -s tests -v     # 141 test, semua offline
python3 -m rsi.cli run --improve             # CLI: run + loop + dashboard
python3 -m rsi.cli improve                   # jalankan loop pada memory yang ada
python3 -m rsi.cli benchmark                 # snapshot metrik antar eksperimen-arm
python3 -m rsi.cli dashboard                 # buat runs/dashboard.html
python3 -m rsi.cli skills --out-dir .        # export SKILL.md / CLAUDE.md
python3 -m rsi.cli rao --target-dir .        # RAO: self-assess + tulis ulang skill file
python3 -m rsi.cli audit --verify            # verifikasi hash-chain audit
python3 -m rsi.cli status                    # state satu layar dari runs/
```

## Konvensi

- Python stdlib saja untuk inti (`demo.py`, `rsi/`, `tests/`); tanpa dependensi
  wajib — backend nyata (OpenAI-compatible, TypeSafe) bersifat opsional via env.
- Determinisme: seed stabil (CRC32), `MockJev` murni fungsi state — argumen sama
  menghasilkan hasil sama.
- Lifecycle: exploration (tulis memory) → freeze → test-time read-only; proses
  baru selalu mulai dengan memory yang bisa ditulis lagi.
- Artefak `runs/` (`report.md`, `memory.json`, `attempts.jsonl`, `audit.jsonl`,
  `cycles.json`, `baseline-mem-*.json`, `applied.json`) adalah output yang
  dihasilkan ulang — jangan diedit manual. `audit.jsonl` hash-chained; editing
  memutuskan chain dan terdeteksi oleh `rsi.cli audit --verify` / dashboard.
- Kunci API (`OPENAI_API_KEY`, `TYPESAFE_API_KEY`) hanya lewat environment,
  tidak pernah di-commit.
