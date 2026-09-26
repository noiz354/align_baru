# AUDIO QUALITY

Requirements: FR-AUDIO-012/017 · ADR-0009 (48 kHz mono Opus, −16 LUFS target, 16 kHz derivative) ·
Related: `docs/media/AUDIO-PIPELINE.md`, `docs/transcription/PIPELINE.md`

---

## 1. What "good enough" means here

The primary use of the audio is (a) someone listening later and (b) machine transcription that a human
then reviews. Both are harmed by the same things: clipping, hum, rumble, silence at the wrong moments,
and wildly inconsistent loudness. Spatial realism and music-grade fidelity are **not** goals — this is
speech from a mosque hall.

| Target | Value | Why |
|---|---|---|
| Sample rate | 48 kHz capture, mono | Matches typical device capture; mono is exactly right for a single PA feed |
| Capture bitrate | 24 kbps Opus (range 16–48) | Speech intelligibility with small files |
| Master | 48 kHz mono, Opus in a **seekable Ogg** container after remux | Playability (`<audio>` needs seekable containers for a 2-hour timeline) |
| Loudness target | −16 LUFS integrated, true peak ≤ −1.5 dBTP | Consistent levels between events without crushing dynamics |
| Noise floor guidance | −50 dBFS or better | Below this, transcription improves markedly |
| Transcription derivative | 16 kHz mono (lossless-from-Opus re-decode) | Optimal for ASR, smaller transfer to a provider, no double-compression artefacts |
| Master retention | Never deleted by normal operation | It is the only irreplaceable artefact (`RETENTION.md`, ADR-0009) |

## 2. Where quality is decided (before software can help)

Most quality problems are **not software problems**:

| Cause | Symptom | What the product can do |
|---|---|---|
| Microphone too far from the speaker/PA | Room echo, low level | Guidance page: distance, placement, avoid the speaker's monitor |
| PA feed overloaded at the source | Clipping/distortion | Warn about input level during recording (level meter guidance, pre-start advice) |
| Phone's built-in mic while recording in a noisy room | Crowd noise dominates | Recommend an external mic or a direct PA feed; document it as a prerequisite |
| Android battery saver throttling | Dropped chunks, stutter | Warning about battery optimisation before starting |
| Bluetooth headset in SCO mode | Narrowband 8 kHz sound | Warn that Bluetooth microphones degrade quality; prefer wired/PA |
| Venue power/network loss | Gap | Honest gap reporting; recommend external power |

Rule: the product **tells the truth about quality** but never claims to fix acoustic problems.

## 3. In-session quality signals (client-side, advisory)

| Signal | Detection | UI |
|---|---|---|
| Silence | RMS below threshold for > 30 s while the session is not paused | Quiet notice: "Sepertinya tidak ada suara — pastikan mikrofon/PA terpasang" |
| Clipping | Sustained near-0 dBFS samples | Notice: "Suara terlalu keras/terpotong — turunkan gain di sumber" |
| Very low level | RMS below range for > 2 min | Notice with a one-tap "tingkatkan volume sumber" checklist |
| Rumble/hum | Energy concentrated < 80 Hz or 50 Hz hum peaks | Advisory only (cannot be removed without altering voice) |
| Device change | `ondevicechange` / track change | Notice; input device recorded for the affected range |
| Gap | Missing sequence after recovery | Notice + gap listed in the session summary |

These signals are **advisory**: they never stop recording, never alter audio, and never mark the session
as failed. They exist so the operator can act during the event, when action is still possible.

## 4. Server-side processing (what we do and refuse to do)

Performed: decode to PCM, remove DC offset, gentle high-pass at 60 Hz, loudness normalisation to −16
LUFS, true-peak limiting, encode to the seekable master, and produce the 16 kHz ASR derivative.

**Refused:** noise removal via ML, dereverberation, spectral "enhancement", speaker separation,
automatic gain riding within a session (it makes levels unnatural and can break ASR alignment), and any
processing that is not idempotent and reproducible from the master + a recorded configuration version.
Reason: the master must remain the ground truth for a quotation.

## 5. Quality reporting to the organizer

Each completed session lists: duration, input device(s), gap count and total gap time, mean/min/max
level class, whether clipping was detected, the processing configuration version, and a plain-language
verdict:

| Verdict | Condition | Organizer-facing wording |
|---|---|---|
| Baik | No gaps, no clipping, level in range | "Rekaman siap dipublikasikan" |
| Cukup | Minor gaps (< 30 s) or level slightly off | "Rekaman dapat dipublikasikan; ada catatan kecil" |
| Bermasalah | Gaps > 2 min, clipping throughout, or long silence | "Rekaman bermasalah: <ringkasan konkret>" |
| Tidak dapat diproses | Malformed input after retries | "Rekaman tidak dapat diproses — hubungi <peran>" |

The verdict is **descriptive, not punitive**, and never affects any person's standing.

## 6. Accessibility and listening experience

1. Playback always ships with a transcript link (when published) and a speed control (0.75×–2×).
2. Seek accuracy on the published player must be ≤ 1 s (a remuxed seekable master is a functional
   requirement, not a nicety).
3. Auto-play is off; the player remembers the position per session on the device (local only).
4. No player is rendered for `INTERNAL` sessions outside authorized roles (`AUDIO.md` §5).
5. Chapter markers (when present) land within 1 s of the marked moment.

## 7. Verification

| Check | Method | Threshold |
|---|---|---|
| Loudness | Measure the master after processing | −16 LUFS ± 1 LU |
| True peak | Measure | ≤ −1.5 dBTP |
| Seekability | Player test at 10 random positions | ≤ 1 s error, no stall |
| Duration fidelity | Session wall-clock vs asset duration | ≤ chunk interval difference |
| Derivative correctness | 16 kHz, mono, duration matches | exact |
| Processing reproducibility | Re-run processing on the same master with the same config version | byte-comparable output or documented exception (encoder nondeterminism) |
| Fixture coverage | `tests/fixtures` audio set | clipping, silence, PA feed, code-switching |
