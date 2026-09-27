# RSI Agent — Recursive Self-Improvement untuk Coding Agent (dengan Jev dalam Orkestrasi)

Prototipe kerja yang mengimplementasikan arsitektur pada rangkuman referensi:
**RSI loop** (Curriculum → Actor → Verifier di atas persistent memory, fase
BRS → DRS → freeze → test-time) plus **lapisan orkestrasi dengan Jev**
(TypeSafe) sebagai *System One decision model* — routing, guardrail, grading,
dan done-check dalam bentuk keputusan bertipe.

Parameter model **tidak pernah diubah** (training-free). Yang "meningkat" adalah
**memory**: pelajaran terverifikasi yang ditulis selama eksplorasi dan dipakai
ulang apa adanya saat test-time.

Sejak v0.2 ada **bounded self-improvement loop** di atas memory itu: evidence
hasil eksplorasi → `ImprovementProposal` → kandidat terisolasi → evaluasi
baseline-vs-candidate → accept/reject/escalate → apply → verifikasi →
rollback. Semuanya terbatas (limits), teraudit (hash-chained `audit.jsonl`),
reversibel (`baseline-*.json`), dan dijaga gerbang manusia untuk risk
HIGH/CRITICAL. Lihat `TASKS.md`, `TRACEABILITY.md`, `SECURITY.md`.

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
cd rsi-agent-recursive-self-improvement-prototype
python3 demo.py                         # run offline penuh (mock LLM + mock Jev)
python3 demo.py --improve --max-cycles 2  # + bounded improvement loop
python3 -m unittest discover -s tests -v  # 141 test, semua offline
python3 -m rsi.cli run --improve          # CLI: run + loop + dashboard
python3 -m rsi.cli status                 # state satu layar dari runs/
python3 -m rsi.cli audit --verify         # verifikasi hash-chain audit
```

Artikel yang dihasilkan ada di `runs/`:

| Berkas | Isi |
|---|---|
| `runs/report.md` | Laporan metrik per fase + cold vs warm + sampel lesson |
| `runs/memory.json` | Persistent memory (prosedur + boundary lessons) |
| `runs/attempts.jsonl` | Trace ReAct lengkap per attempt (untuk benchmark/dashboard) |
| `runs/audit.jsonl` | Audit trail hash-chained dari tiap keputusan improvement |
| `runs/cycles.json` | Riwayat siklus improvement + loop health |
| `runs/baseline-*.json` | Snapshot baseline pra-apply (bahan rollback) |
| `runs/dashboard.html` | Dashboard statis self-contained |

Opsi CLI:

```bash
python3 demo.py --waves 3 --drs-rounds 3 --holdout 12 --seed 7
python3 demo.py --resume            # lanjut dari runs/memory.json yang ada
python3 demo.py --improve           # improvement loop (limits di demo.py --help)
python3 demo.py --skills-dir .      # export SKILL.md / CLAUDE.md dari memory
python3 demo.py --backend openai    # actor LLM nyata (OPENAI_API_KEY)
python3 demo.py --jev typesafe      # judge Jev nyata (TYPESAFE_API_KEY)
python3 -m rsi.cli benchmark        # snapshot metrik antar eksperimen-arm
python3 -m rsi.cli skills --out-dir .   # tulis skill file dari memory
python3 -m rsi.cli rao --target-dir .   # RAO: self-assess + tulis ulang skill file
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
rsi-agent-recursive-self-improvement-prototype/
├── demo.py                 # entrypoint: explore → improve → freeze → evaluate → report
├── rsi/
│   # core loop
│   ├── types.py            # Task, Lesson, Attempt, Verdict, Action, SolveResult
│   ├── memory.py           # PersistentMemory + revision/snapshot/restore
│   ├── jev.py              # typed questions, MockJev, TypeSafeJev (adapter)
│   ├── curriculum.py       # CurriculumAgent: propose_broad / propose_deep / holdout
│   ├── planners.py         # Planner protocol, MockPlanner, OpenAICompatPlanner
│   ├── tools.py            # tool surface (run_tests, read/write, grep)
│   ├── harness.py          # ReActHarness: Context → LLM → Tool → Memory → loop
│   ├── actor.py            # ActorAgent: menjalankan task via harness + route
│   ├── verifier.py         # VerifierAgent: Jev score + done → lesson extraction
│   ├── routing.py          # OrchestrationLayer: Jev guard + Choice routing
│   ├── orchestrator.py     # RSIOrchestrator: BRS → DRS → freeze → cold/warm
│   # self-improvement layer
│   ├── feedback.py         # FeedbackRecord → Evidence (DATA vs INSTRUCTIONS)
│   ├── risk.py             # classify LOW/MEDIUM/HIGH/CRITICAL + approval policy
│   ├── sandbox.py          # CandidateWorkspace + path containment + secret scan
│   ├── patches.py          # LessonChangeSet / FilePatch + base-revision check
│   ├── audit.py            # append-only hash-chained audit log
│   ├── evaluator.py        # baseline-vs-candidate + acceptance + tamper detector
│   ├── proposals.py        # ImprovementProposal + evidence-based generator
│   ├── improvement.py      # ImprovementLoop: bounded, lock, idempotent, rollback
│   ├── metrics.py          # loop health (acceptance/regression/rollback rates)
│   ├── benchmark.py        # snapshot + diff antar eksperimen-arm
│   ├── dashboard.py        # runs/dashboard.html (statis, self-contained)
│   ├── skills.py           # memory → SKILL.md / CLAUDE.md
│   ├── rao.py              # RAO: self-assess → tulis ulang skill file (gated)
│   └── cli.py              # run / improve / benchmark / dashboard / skills / rao / audit / status
└── tests/
    ├── test_rsi.py         # 10 — core loop
    ├── test_improvement.py # 50 — proposals/sandbox/patches/risk/loop/limits
    ├── test_adversarial.py # 38 — tampering, escape, injection, resource limits
    ├── test_artifacts.py   # 34 — benchmark/skills/RAO/dashboard/CLI
    └── test_manual_qa.py   # 9  — walkthrough loop 14 langkah end-to-end
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

141 test, semuanya offline. Selain cakupan inti (freeze memblokir write,
roundtrip memory, determinisme MockJev, guardrail injeksi prompt, routing
sulit ke `deep_model`, ReAct terminasi, eskalasi human, arsip memory basi,
warm-beats-cold), suite sekarang mencakup **improvement loop** (proposal →
isolasi → evaluasi → accept/reject → apply → verifikasi → rollback), **risk
gates**, **sandbox containment + secret scan**, **hash-chain audit**,
**idempotency ledger**, **stagnation stop**, **adversarial cases** (candidate
menghapus test, mengubah threshold evaluator, membaca expected answer, mengedit
audit log, escape sandbox, injeksi via feedback, menyelundupkan secret,
resource limits) — lihat `TESTING.md` untuk inventory lengkap.

## Roadmap

| # | Item | Status |
|---|---|---|
| 1 | **Benchmark command** ala `recursive-improve benchmark`: snapshot metrik per run, diff antar eksperimen-arm | ✅ IMPLEMENTED (`python3 -m rsi.cli benchmark`, `rsi/benchmark.py`) |
| 2 | **Dashboard** atas `attempts.jsonl`: trace, success rate per kategori/fase, proposal/evaluasi/rollback/audit | ✅ IMPLEMENTED (`python3 -m rsi.cli dashboard`, `rsi/dashboard.py`) |
| 3 | **RAO loop**: agent menilai report-nya dan menulis ulang skill file — manusia di luar loop (human gate) | ✅ IMPLEMENTED (`python3 -m rsi.cli rao`, `rsi/rao.py`) |
| 4 | **Memory sebagai skill file Markdown** untuk Claude Code / Codex | ✅ IMPLEMENTED (`python3 -m rsi.cli skills`, `rsi/skills.py`) |
| 5 | Bounded self-improvement loop (proposal → sandbox → evaluasi → apply → verify → rollback) | ✅ IMPLEMENTED (`rsi/improvement.py`) |
| 6 | Real Jev (TypeSafe) semantics | ⏸ EXTERNALLY BLOCKED (butuh `TYPESAFE_API_KEY` + contract — T-EXT-001) |
| 7 | Real LLM actor backend | ✅ ADAPTER READY (`OpenAICompatPlanner`; butuh `OPENAI_API_KEY` untuk dipakai — T-EXT-002) |

Detail per-task: `TASKS.md` · Traceability requirement→test: `TRACEABILITY.md` ·
Security & threat model: `SECURITY.md` · Evaluasi & acceptance: `EVALUATION.md` ·
Rollback: `ROLLBACK.md` · Observabilitas: `OBSERVABILITY.md` · Memory policy:
`MEMORY.md` · Testing: `TESTING.md` · Slice plan: `ROADMAP.md`

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
