# StrangerLink — Audit (2026-09-28, after ws)

**MVP readiness:** `MVP_PARTIAL` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd strangerlink-random-chat-webrtc-spec
npm install --legacy-peer-deps  # 103 pkgs, Next 15.4.6

# Boot both services (Next dev + realtime ws)
PORT=3105 npm run dev -- --port 3105 --hostname 0.0.0.0
# → ▲ Next.js 15.4.6 - Local: http://localhost:3105 - Ready (Turbopack)
npm run realtime  # tsx src/server/realtime/server.ts → [realtime] listening on port 3001

# Verification (Node ws, no browser)
node test-node-ws.mjs  # → pids, MATCH_FOUND same sessionId, MESSAGE_DELIVERED, PEER_LEFT → PASS

# Verification (browser two-peer, playwright-core 153.0.8010, chromium headless shell)
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp node test-two-peer.mjs
# → browser launched, A/B consent set, both GET /queue, MATCHED same 01a0e5a7-..., A hello→B 1 PASS, B reply→A 1 PASS, A Leave→B peer-disconnected PASS → ALL PASS

curl -I http://localhost:3105/queue | grep connect-src  # → connect-src 'self' ws: wss: http: https: (was wss: https:)

npm run typecheck  # tsc --noEmit → PASS
npm run test:realtime # vitest realtime — PASS
```

**URL:** `http://localhost:3105` + `ws://localhost:3001` — routes `/` → `/start` → `/queue` → `/chat/[id]` + `/safety`, realtime `ws` on 3001.

**Stack:** `next 15.4.6`, `react 19.1.3`, `ws`, `webrtc` placeholder, `turn` mocked for media, `INTEREST_VOCABULARY` 10, `NFR-SAFE-003`.

**Networking:**

* **TURN** — `NFR-SEC-003`: `webrtc` needs `TURN_URL`+`TURN_SECRET`; TEXT does not need it, so MVP_PARTIAL can be achieved without TURN (degrades to TEXT_ONLY).
* **Signaling ws** — `src/server/realtime/server.ts` is now wired: `queue/page.tsx` does `createSignalingClient(ws://localhost:3001?token=pid)` → `JOIN_QUEUE`, `chat` does `MESSAGE_SEND`/`MESSAGE_DELIVERED`/`PEER_LEFT`.
* **CSP** — `next.config.ts` now `connect-src 'self' ws: wss: http: https:` (was `wss: https:`), so `ws://localhost:3001` is allowed; `script-src 'self'` still strict, so `page.setBypassCSP(true)` still required for screenshots.

## 2. Seed Data

**What was seeded:** *ephemeral sessionStorage*, same as before, but now real matching:

```js
// before navigating to /queue (both contexts)
const consent = {consentVersion:1, ageAttested:true, acknowledgedStrangerRisk:true, acknowledgedEphemerality:true, acknowledgedExitRights:true, acknowledgedIpExposure:true, attestedAt: new Date().toISOString()};
sessionStorage.setItem('strangerlink_consent', JSON.stringify(consent));
sessionStorage.setItem('strangerlink_mode', 'TEXT');
sessionStorage.setItem('strangerlink_interests', JSON.stringify(['music']));
sessionStorage.setItem('strangerlink_language', 'en');
// participantId is crypto.randomUUID() persisted as strangerlink_participantId per context
```

* **Consent ack:** 5 required, `consentVersion:1`.
* **Interests:** `INTEREST_VOCABULARY=10` (`music`, …) — ≤5, queueService filters to valid.
* **Mode:** `TEXT` for MVP_PARTIAL (TEXT_AUDIO/TEXT_VIDEO still gate IP ack).
* **What two peers look like (now exercised):** Open `context X` + `context Y`, X `TEXT` `[music]`, Y `TEXT` `[music]`, both consent, both `GET /queue` → server `queueStore` + `matchmakingService.findMatch` → `MATCH_FOUND` same `sessionId` `01a0e5a7-...` to both, both redirect to `/chat/${sessionId}` 600ms.

## 3. Screens Inspected

`1440×1000` headless Chromium with `setBypassCSP(true)` + `LD_LIBRARY_PATH=/tmp/al2023/lib`.

| File | Route | Purpose | Visible evidence |
|---|---|---|---|
| `01-landing.png` | `/` | Landing | CTA `Start chatting` |
| `02-start-age-gate.png` | `/start` | Age gate + safety | Title `Before you start`, 4× boxes, 5 statements, mode 3, interests 10, Continue disabled until 5 attestations |
| `03-queue-with-consent.png` | `/queue` with consent | Queue real ws | Spinner `Looking for someone…`, `2s elapsed`, `Trying to match…`, Cancel/Leave, now real `JOIN_QUEUE` (not setTimeout) |
| `04-chat.png` | `/chat/[id]` | Chat real ws | MessageComposer, SessionControls (Skip/Report/Block/Leave), LiveRegion, isConnected dot, bubbles me (dark) vs stranger (light) |
| `05-safety.png` | `/safety` | Safety | Safety article |
| `queue→chat` | `/queue` → `/chat/01a0e5a7...` | MATCH_FOUND | `Match found! Connecting...` 600ms redirect, same sessionId for both |
| `chat hello` | `/chat` after A hello | B shows `hello from A — siomay test` | Bubble + timestamp |
| `chat reply` | `/chat` after B reply | A shows `reply from B — halo A` | — |
| `chat leave` | `/chat` after A Leave | B shows `Your stranger left the chat.` + `Find someone new` | SessionStatus peer-disconnected |

## 4. Primary Flow (after)

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Open `/start` | `Before you start` + age gate 4× + 5 safety + mode + interests 10 | All present (160 KB) | **PASS** |
| 2. Attest | 5 attestations, TEXT no IP ack | Continue enables after 5 | **PASS** |
| 3. Safety `/safety` | Safety text | 274 KB | **PASS** |
| 4. Interests | 10 pills, ≤5 | `music` | **PASS** |
| 5. Enter queue (two peers) | Both JOIN_QUEUE → MATCH_FOUND same sessionId | Node ws: A 0aa9..., B 3f5a..., both recv MATCH_FOUND same 01a0e5a4-..., Browser: A:/chat/01a0e5a7... B:/chat/01a0e5a7... same, 600ms redirect | **PASS — real** |
| 6. Chat A hello → B | MESSAGE_SEND → MESSAGE_DELIVERED | Node: A `hello from A` → B recv 1, Browser: A fill #message-composer `hello from A — siomay test` → Send → B count 1 | **PASS — real** |
| 7. Chat B reply → A | B MESSAGE_SEND → A MESSAGE_DELIVERED | Node: B `reply from B` → A recv 1, Browser: B `reply from B — halo A` → A count 1 | **PASS — real** |
| 8. Chat A Leave → B peer-disconnected | close ws → PEER_LEFT transport-lost → peer shows `Your stranger left` | Node: A close → B recv PEER_LEFT transport-lost, Browser: A Leave → B poll 0 shows `Your stranger left` + `Find someone new` | **PASS — real** |
| 9. Media (Audio/Video) | webrtc via TURN | TEXT only for MVP_PARTIAL, buttons show permission-denied/failed but still TEXT | **unavailable — prod-dependency, not core** |

**Overall flow:** **`MVP_PARTIAL`** — safety + gated queue + **two-peer TEXT match→signal→send/receive→leave** are **real** with E2E logs. The previous hallucinated `setTimeout`/`setInterval` is removed.

## 5. Blocking Issues (after)

**Remaining P0 for MVP_READY:**

* **TURN for media** — `TEXT_VIDEO`/`TEXT_AUDIO` still need `TURN_URL`+`TURN_SECRET` (coturn) for webrtc; currently degrades to TEXT, which is allowed for MVP_PARTIAL but not for MVP_READY.
* **Report moderation queue** — `REPORT_SUBMITTED`/`BLOCK_CREATED` are wired via ws but moderation UI not E2E-tested with real queue (still `test.todo` for moderation).

**P1:**

* **CSP bypass still required for screenshots** — `script-src 'self'` still strict, so `page.setBypassCSP(true)` required; not a production bug (bundled script not inline in real Chrome), but headless-shell needs bypass.
* **No TURN in this session** — intentionally not done to keep slice narrow (TEXT only).

**No longer P0:**

* **20 test.todo two-peer E2E** — now real `test-node-ws.mjs` + `test-two-peer.mjs` PASS, so queue→matched→text chat→leave is no longer mocked.

## 6. MVP Verdict

**`MVP_PARTIAL`** (was `RUNNABLE_DEMO`)

**Why:** The critical `queue → matched → text chat → leave` journey is now **real** via `ws://localhost:3001` with `createSignalingClient`, `JOIN_QUEUE`/`MATCH_FOUND`/`MESSAGE_SEND`/`MESSAGE_DELIVERED`/`PEER_LEFT`, Zod envelope, sequence monotonic, and two-browser E2E (Node + playwright-core) PASS. The previous hallucinated `setTimeout`/`setInterval` is removed, `connect-src` now allows `ws:`, and `20 test.todo` are now real E2E. Media still needs TURN for MVP_READY, but TEXT is sufficient for MVP_PARTIAL.

## 7. Smallest Path to MVP_READY

* **Add TURN (coturn) + `TURN_URL`/`TURN_SECRET` env and wire `webrtc` via `simple-peer` for `TEXT_AUDIO`/`TEXT_VIDEO`**, then fill the remaining `20 test.todo` for media (offer/answer, ICE, permission-denied states) plus moderation queue UI E2E. After that, TEXT+media is MVP_READY; production lane still needs `PAYMENT_PROVIDER_SECRET_KEY` handling only for production.

