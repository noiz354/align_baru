# ADR-0026 — Layered QR scanning: native BarcodeDetector first, zxing-wasm fallback

- Status: Accepted · Date: 2026-09-26 · Deciders: UX engineer, Principal Architect, QA
- Requirements affected: FR-CHECKIN-001/003/010, NFR-PERF-004, NFR-A11Y-003
- Related: ADR-0006, `docs/security/QR-SECURITY.md`, `CHECKIN.md`

## Context

The scanner runs on volunteers' own phones, in daylight, at a queue, with a camera pointed at a
participant's screen or a printed page. Cameras, browsers and lighting vary wildly; some devices
are old Androids. Scanning must be fast, must never be a single point of failure, and must work
in the browsers people actually have (Chrome/Android dominant, Safari/iOS common, Firefox
occasional).

Library options in 2026 differ substantially: the W3C Shape Detection API (`BarcodeDetector`)
is native and fastest but is **absent in Firefox** and version-dependent in Safari; `zxing-wasm`
is a maintained WASM port with broad format support and `rawBytes`; `zxing-js` (pure JS) is
slower; `jsQR` is dormant and QR-only; `html5-qrcode` bundles ZXing-JS plus its own UI.

## Decision

A **two-tier strategy behind one `QrScanner` port**, chosen at runtime:

- **Tier 1 (preferred): `BarcodeDetector`** when available (`'BarcodeDetector' in window` and a
  successful `getSupportedFormats()` including `qr_code`). Zero bundle cost, native speed.
- **Tier 2 (fallback): `zxing-wasm`**, loaded **lazily and only when needed** (`~2 MB` WASM,
  cached after first use). Used when Tier 1 is missing or throws.
- **Tier 0 (always present): manual entry.** A short-code field and a name search. This is not a
  fallback of last resort; it is a first-class path (`NFR-A11Y-003`) reachable in one tap from
  any failure state.
- **Decoding rules:** QR-only detection (`formats: ['qr_code']`) to reduce CPU; the decoded
  payload is parsed **strictly** with our `parseCheckInPayload()` validator; anything that does
  not match the expected shape is rejected locally with `INVALID_FORMAT` and never sent to the
  server (protects the API from junk traffic and the network from noise).
- **Capture discipline:** `getUserMedia({ video: { facingMode: 'environment', width: { ideal:
  1280 } } })`, decode at ~10 fps (throttled), stop tracks on unmount/navigation (battery and
  privacy), `torch` capability exposed when supported, camera switch for devices with
  multiple rear cameras.
- **Feedback coupling:** a successful decode immediately pauses further decoding until the
  server responds (prevents double-fire from a long exposure at the same code), then resumes
  automatically (≤ 400 ms) — and the same token scanned again within the session is handled as
  `ALREADY` (ADR-0025) rather than being suppressed, so operators are never misled about
  someone who genuinely scanned twice at two entrances.
- **No server-side decoding**: QR/image upload for decoding is not part of the entrance path
  (it would put the queue behind the network).
- **Secure context required:** production must be HTTPS; the app detects and explains
  `NotAllowedError`/insecure-context failures with an actionable message rather than a black box.

## Alternatives considered

- **`html5-qrcode` only.** *Gains:* batteries-included UI. *Costs:* larger bundle, slower pure-JS
  decoding, embedded UI we must restyle for accessibility and 40 px result text. *Rejected* as
  primary; acceptable as a Tier-2 substitute if `zxing-wasm` is ever unsuitable (documented).
- **`zxing-wasm` only (no native tier).** *Costs:* 2 MB payload and WASM init on every device,
  including the majority where the native API is available and faster. *Rejected as primary.*
- **`BarcodeDetector` only.** *Costs:* Firefox users (real volunteers) get no scanning; Safari
  support varies by version. Unacceptable for a volunteer-run product. *Rejected.*
- **`jsQR`.** *Costs:* dormant maintenance, QR-only, no camera handling, slower. *Rejected.*
- **Commercial SDK (Scandit, Dynamsoft, Scanbot).** *Gains:* best-in-class decoding on hard
  images. *Costs:* per-device/per-scan licensing, a vendor dependency in the entrance path, and
  a procurement conversation a mosque committee will not have. *Rejected* for MVP; explicit
  escalation path if field decoding failure rates exceed tolerance (documented as a future ADR).
- **Decoding on the server (upload a photo).** *Costs:* latency on the tightest path, bandwidth,
  privacy (photos of participants' screens). *Rejected.*
- **NFC / Bluetooth proximity check-in.** *Costs:* hardware assumptions; excludes most devices.
  *Rejected* (`NFR-MOB-006`).

## Consequences

**Positive:** fastest path on most devices with no download; universal fallback; one port keeps
the rest of the code independent of decoding library choices; manual fallback is always present;
no vendor cost.

**Negative:** two code paths to test (mitigated by the same `QrScanner` port contract and a
shared Playwright suite that forces each tier via a flag); the WASM fallback adds a first-use
delay on Firefox/Safari (mitigated by prefetching when the tier is selected at session start).

**Neutral:** per-tier telemetry (`scan_backend_latency_ms{backend}`) lets us measure in the field
which tier real volunteers get — and whether decoding failures justify an escalation.

## Enforcement

- One `QrScanner` interface; feature code must not import a decoding library directly (lint rule).
- A test asserts the payload parser rejects: JSON with PII, tokens for the wrong prefix, over-long
  strings, and URLs with extra parameters (must not silently accept unknown shapes).
- A test asserts decoding is stopped when the page is hidden and on unmount.
- Telemetry must record backend tier + decode duration + failure reason, with no payload content
  (`OBSERVABILITY.md` §Forbidden attributes).

## Revisit trigger

Reopen if field telemetry shows first-scan success < 95% (`M1`) attributable to decoding, or if
`BarcodeDetector` becomes available across all target browsers (then Tier 2 can be dropped from
the default bundle entirely).
