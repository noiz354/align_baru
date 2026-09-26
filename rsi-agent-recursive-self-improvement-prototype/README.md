# RSI Agent — Recursive Self-Improvement untuk Coding Agent (dengan Jev dalam Orkestrasi)

Prototipe kerja yang mengimplementasikan arsitektur pada rangkuman referensi:
**RSI loop** (Curriculum → Actor → Verifier di atas persistent memory, fase
BRS → DRS → freeze → test-time) plus **lapisan orkestrasi dengan Jev**
(TypeSafe) sebagai *System One decision model* — routing, guardrail, grading,
dan done-check dalam bentuk keputusan bertipe.

Parameter model **tidak pernah diubah** (training-free). Yang "meningkat" adalah
**memory**: pelajaran terverifikasi yang ditulis selama eksplorasi dan dipakai
ulang apa adanya saat test-time.

---

## Arsitektur yang dieksekusi

```
┌────────────────────────────────────────────────────────────────────┐
│  EXPLORATION (menulis memory)                                      │
│                                                                    │
│  Curriculum Agent ──propose──► Actor Agent ──result──► Verifier    │
│  (BRS broad / DRS deep)       (ReAct loop)            Agent        │
│         ▲                                       │                  │
│         └────────── persistent memory ◄── lesson ┘                  │
│              (prosedur + boundary condition)                       │
│                                                                    │
│  per task: Jev.guard(Noul) → Jev.route(Choice) → Actor →           │
│            Jev.score(Score) + Jev.done(Noul) → lesson → memory     │
│                                                                    │
│  FREEZE memory ──► TEST-TIME (read-only; Curriculum & writes off)  │
│    holdout identik: cold (memory kosong) vs warm (memory beku)     │
└────────────────────────────────────────────────────────────────────┘
```

## Quick start

```bash
cd rsi-agent
python3 demo.py                 # run offline penuh (mock LLM + mock Jev)
python3 -m unittest discover -s tests -v    # 10 test, semua offline
```

Artikel yang dihasilkan ada di `runs/`:

| Berkas | Isi |
|---|---|
| `runs/report.md` | Laporan metrik per fase + cold vs warm + sampel lesson |
| `runs/memory.json` | Persistent memory (prosedur + boundary lessons) |
| `runs/attempts.jsonl` | Trace ReAct lengkap per attempt (untuk benchmark/dashboard) |

Opsi CLI:

```bash
python3 demo.py --waves 3 --drs-rounds 3 --holdout 12 --seed 7
python3 demo.py --resume            # lanjut dari runs/memory.json yang ada
python3 demo.py --backend openai    # actor LLM nyata (OPENAI_API_KEY)
python3 demo.py --jev typesafe      # judge Jev nyata (TYPESAFE_API_KEY)
```

## Hasil demo (seed 0, offline)

```
[BRS wave 1/2]  6 tasks | success 1/6 (17%) | memory  6 lessons
[BRS wave 2/2]  6 tasks | success 4/5 (80%) | memory 11 lessons | escalated 1
[DRS round 1/2] 4 tasks | success 3/4 (75%) | memory 15 lessons
[DRS round 2/2] 4 tasks | success 3/4 (75%) | memory 19 lessons
memory FROZEN at 19 lessons (21 knowledge keys)
[TEST cold] 12 tasks | success  1/11 ( 9%)
[TEST warm] 12 tasks | success  7/11 (64%)
```

| Kondisi | Success rate | Avg score |
|---|---|---|
| Cold (memory kosong) | 9% | 0.61 |
| Warm (memory beku, 19 lesson) | **64%** | 0.84 |

Delta itulah efek RSI-nya: pengalaman yang ditulis saat eksplorasi dipakai ulang
di test-time pada holdout yang **identik**, tanpa menyentuh parameter model.
Satu-satunya task yang tidak dieksekusi otonom di kedua kondisi adalah task
injeksi prompt — guardrail Jev mengeskalasikannya ke human workflow.

## Empat titik keputusan Jev

Jev tidak menulis kode — ia menjawab **typed questions** atas state dan
mengembalikan jawaban terstruktur. Di pipeline ini ada empat:

| # | Keputusan | Tipe Jev | Pertanyaan | Pemakaian |
|---|---|---|---|---|
| 1 | Guardrail | **Noul** (0–1) | "Apakah request ini aman untuk diotomasi?" | Deteksi injeksi prompt / exfiltrasi → eskalasi human |
| 2 | Routing | **Choice** + probabilitas | "Eksekutor termurah yang cukup?" | `fast_model` / `deep_model` / `human` |
| 3 | Grading | **Score** (rubrik) | "Seberapa bagus attempt ini?" | Kualitas vs rubrik: checks, bukti trace, output |
| 4 | Done-check | **Noul** (0–1) | "Apakah task sudah benar-benar selesai?" | Verdict final Verifier (pass ≥ 0.5) |

Contoh bentuk keputusannya (`rsi/jev.py`):

```python
from rsi.jev import ChoiceQuestion, NoulQuestion, MockJev

jev = MockJev()                      # atau TypeSafeJev() untuk API asli
answer = jev.choose(ChoiceQuestion(
    prompt="Route this task to the cheapest sufficient executor.",
    options=["fast_model", "deep_model", "human"],
    state={"difficulty": 0.8, "risk": 0.0},
))
answer.option         # 'deep_model'
answer.probabilities  # {'fast_model': 0.07, 'deep_model': 0.71, 'human': 0.22}
```

## Struktur proyek

```
rsi-agent/
├── demo.py                 # entrypoint: explore → freeze → evaluate → report
├── rsi/
│   ├── types.py            # Task, Lesson, Attempt, Verdict, Action, SolveResult
│   ├── memory.py           # PersistentMemory (+ freeze yang menulis melempar error)
│   ├── jev.py              # typed questions, MockJev, TypeSafeJev (adapter)
│   ├── curriculum.py       # CurriculumAgent: propose_broad / propose_deep / holdout
│   ├── planners.py         # Planner protocol, MockPlanner, OpenAICompatPlanner
│   ├── tools.py            # tool surface (run_tests, read/write, grep)
│   ├── harness.py          # ReActHarness: Context → LLM → Tool → Memory → loop
│   ├── actor.py            # ActorAgent: menjalankan task via harness + route
│   ├── verifier.py         # VerifierAgent: Jev score + done → lesson extraction
│   ├── routing.py          # OrchestrationLayer: Jev guard + Choice routing
│   └── orchestrator.py     # RSIOrchestrator: BRS → DRS → freeze → cold/warm
└── tests/test_rsi.py       # 10 unittest (memory, Jev, harness, RSI improvement)
```

## Apa yang nyata vs apa yang disimulasikan

| Komponen | Status | Catatan |
|---|---|---|
| RSI loop (BRS/DRS/freeze/test-time) | **Nyata** | `RSIOrchestrator`, deterministik per seed |
| Persistent memory + freeze | **Nyata** | JSON store; write saat frozen melempar `MemoryFrozenError` |
| ReAct harness | **Nyata** | Loop, konteks dari memory, step budget — pluggable planner |
| Jev typed surface (Choice/Score/Noul) | **Nyata** | Kontrak `JevClient` + adapter `TypeSafeJev` |
| Keputusan Jev (MockJev) | **Simulasi** | Heuristik deterministik; ganti `TypeSafeJev()` untuk semantik asli |
| Eksekusi kode (MockPlanner/MockToolset) | **Simulasi** | Lingkungan coding tiruan; ganti `openai_planner_factory()` + toolset nyata |
| Model tier fast/deep | **Simulasi** | Skill 0.35 / 0.75 pada mock; mapping ke model sungguhan di factory |

Desain simulasinya sengaja membuat **memory mengubah outcome**: peluang sukses
adalah fungsi dari skill model, cakupan knowledge key di memory, dan kesulitan
task — jadi efek RSI terlihat terukur, bukan sekadar narasi.

## Menyambungkan komponen nyata

**1. LLM asli untuk Actor** (OpenAI-compatible: OpenAI, vLLM, Ollama, OpenRouter):

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-4o-mini      # tier "fast"
python3 demo.py --backend openai     # tier "deep" lewat openai_planner_factory(deep_model=...)
```

Planner nyata diminta mengeluarkan **satu aksi JSON per turn**
(`thought` / `tool` / `finish` dengan `checks` dan `failure_mode`) — pola yang
sama dipakai Claude Code / Codex. Untuk Anthropic atau provider lain,
implementasikan protokol `Planner` (dua metode + `final_checks`).

**2. Jev asli (TypeSafe):**

```python
from rsi.jev import TypeSafeJev
jev = TypeSafeJev()   # TYPESAFE_API_KEY; adapter di rsi/jev.py tinggal disesuaikan
                      # dengan bentuk endpoint publik TypeSafe
```

**3. Toolset nyata:** implementasikan `call(name, args)` di atas shell/fs sungguhan
dan teruskan sebagai `toolset_factory` ke `ActorAgent`. Trace apa adanya masuk
`attempts.jsonl` — siap untuk benchmark ala `recursive-improve`.

## Semantik lifecycle

- **Resume**: run baru mengarsipkan `runs/memory.json` lama ke `memory.prev.json`
  dan mulai bersih (mencegah "kebocoran" warm start). `--resume` melanjutkan dari
  memory yang ada.
- **Freeze**: hanya berlaku dalam satu run (siklus hidup test-time). Proses baru
  selalu mulai dengan memory yang bisa ditulis lagi.
- **Determinisme**: seed stabil (CRC32), MockJev murni fungsi state — run dengan
  argumen sama menghasilkan hasil sama.

## Pengujian

```bash
python3 -m unittest discover -s tests -v
```

Mencakup: freeze memblokir write, roundtrip memory + coverage, determinisme
MockJev, guardrail injeksi prompt, routing task sulit ke `deep_model`, ReAct
loop terminasi pada `finish`, task injeksi tereskalasi ke human, arsip memory
basi, dan **warm memory mengalahkan cold memory pada holdout identik**.

## Roadmap

1. **Benchmark command** ala `recursive-improve benchmark`: snapshot metrik
   kualitas per run, diff antar branch eksperimen (seed / formula / jumlah DRS).
2. **Dashboard** atas `attempts.jsonl`: perbandingan trace, tingkat keberhasilan
   per kategori, pertumbuhan coverage knowledge key.
3. **RAO loop**: setelah run, agent menilai report-nya sendiri dan menulis ulang
   file skill / CLAUDE.md — RSI antar-task dengan manusia di luar loop.
4. **Memory sebagai file skill Markdown** yang bisa dikonsumsi Claude Code /
   Codex langsung, sehingga hasil eksplorasi langsung menjadi instruksi agent.

## Catatan desain

- **Verifier tidak mempercayai Actor.** Verdict datang dari eksekusi nyata
  (checks + output) yang dievaluasi lewat Jev, bukan dari klaim Actor. Lesson
  yang tersimpan selalu `verified=True` artinya *diamati terhadap eksekusi* —
  termasuk lesson dari kegagalan (boundary condition), yang justru bahan bakar
  DRS.
- **Failures are fuel.** Attempt yang gagal menghasilkan lesson `boundary`
  dengan key = failure mode terlemah; `propose_deep` menargetkan key lemah
  tersebut. Inilah loop yang menutup dirinya.
- **Jev di luar, bukan di dalam.** Coding agent tetap coding agent; Jev hanya
  mengambil keputusan terstruktur di sekelilingnya — persis pola orkestrasi
  pada referensi.
