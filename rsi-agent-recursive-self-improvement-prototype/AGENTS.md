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

---

## Cara menjalankan

```bash
python3 demo.py                              # run offline penuh (mock LLM + mock Jev)
python3 demo.py --waves 3 --drs-rounds 3 --holdout 12 --seed 7
python3 demo.py --resume                     # lanjut dari runs/memory.json yang ada
python3 demo.py --backend openai             # actor LLM nyata (OPENAI_API_KEY)
python3 demo.py --jev typesafe               # judge Jev nyata (TYPESAFE_API_KEY)
python3 -m unittest discover -s tests -v     # 10 test, semua offline
```

## Konvensi

- Python stdlib saja untuk inti (`demo.py`, `rsi/`, `tests/`); tanpa dependensi
  wajib — backend nyata (OpenAI-compatible, TypeSafe) bersifat opsional via env.
- Determinisme: seed stabil (CRC32), `MockJev` murni fungsi state — argumen sama
  menghasilkan hasil sama.
- Lifecycle: exploration (tulis memory) → freeze → test-time read-only; proses
  baru selalu mulai dengan memory yang bisa ditulis lagi.
- Artefak `runs/` (`report.md`, `memory.json`, `attempts.jsonl`) adalah output
  yang dihasilkan ulang — jangan diedit manual.
- Kunci API (`OPENAI_API_KEY`, `TYPESAFE_API_KEY`) hanya lewat environment,
  tidak pernah di-commit.
