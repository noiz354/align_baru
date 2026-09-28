# StrangerLink — BEFORE (2026-09-28, RUNNABLE_DEMO)

**Baseline:** `7641230` · **Target:** `RUNNABLE_DEMO` → `MVP_PARTIAL` (two-peer TEXT match→signal→send/receive→leave with real E2E)
**Result:** **NOT YET** — queue and chat were simulated, not real.

## Runtime (before)

```bash
cd strangerlink-random-chat-webrtc-spec
npm install --legacy-peer-deps  # 103 pkgs, Next 15.4.6
PORT=3105 npm run dev -- --port 3105 --hostname 0.0.0.0  # → http://localhost:3105
# realtime not started (or started but not wired)
npm run realtime  # tsx src/server/realtime/server.ts — ws on 3001, but queue page did not use it
```

**URL:** `http://localhost:3105` — routes `/` → `/start` → `/queue` → `/chat/[id]` + `/safety`.

**Seed (ephemeral):**
```js
sessionStorage.setItem('strangerlink_consent', JSON.stringify({consentVersion:1, ageAttested:true, acknowledgedStrangerRisk:true, acknowledgedEphemerality:true, acknowledgedExitRights:true, acknowledgedIpExposure:true, attestedAt: new Date().toISOString()}));
sessionStorage.setItem('strangerlink_mode', 'TEXT');
sessionStorage.setItem('strangerlink_interests', JSON.stringify(['music']));
```

## Screens (before, 7 files, 1440×1000, setBypassCSP)

| File | Route | Evidence | Note |
|---|---|---|---|
| `01-landing.png` (43 KB) | `/` | CTA `Start chatting` | CSP blank without bypass |
| `02-start-age-gate.png` (160 KB) | `/start` | Age gate 4× + safety 5 + mode 3 + interests 10 | Continue disabled until 5 attestations |
| `03-queue.png` (27 KB) | `/queue` without consent | Guard → `/start` | Correct gating |
| `03-queue-with-consent.png` (27 KB) | `/queue` with consent | Spinner `Looking for someone…` 2s elapsed, Cancel/Leave | Searching, but auto-match via setTimeout 3-8s, not ws |
| `04-chat.png` (41 KB) | `/chat/[id]` | Simulated strangerMessages interval 3s, handleSend local only | No ws, no MESSAGE_DELIVERED, no PEER_LEFT |
| `05-safety.png` (274 KB) | `/safety` | Safety article | — |
| `mobile-01-landing.png` (2.7 KB) | `/` mobile | CTA stacked | — |

## Primary Flow (before, hallucinated)

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| queue → match | JOIN_QUEUE → MATCH_FOUND via ws, same sessionId for both peers | `setTimeout 3000+Math.random()*5000` → `session-${Date.now()}` local, no ws, no sessionStore | **FAIL — hallucinated** |
| chat → send | MESSAGE_SEND → MESSAGE_DELIVERED via ws, peer receives | `handleSend` does `setMessages([...prev, {sender: 'me'}])` local only, stranger via `setInterval` random, not ws | **FAIL — hallucinated** |
| chat → leave | close ws → PEER_LEFT to peer, peer shows `peer-disconnected` | `handleLeave` does `window.location.href='/'` local, no ws close, peer not notified | **FAIL — hallucinated** |
| CSP | `connect-src 'self' wss: https:` | Blocks `ws://localhost:3001`, so even if ws wired, browser would block | **FAIL — CSP** |
| Tests | 20 test.todo | — | **FAIL — no E2E** |

## What was mocked

- `queue/page.tsx` simulated `matchTimeout` 3-8s, no `createSignalingClient`, no `JOIN_QUEUE`.
- `chat/[sessionId]/page.tsx` simulated `strangerMessages` interval, no `MESSAGE_SEND`/`MESSAGE_DELIVERED`, no `PEER_LEFT`.
- `next.config.ts` `connect-src 'self' wss: https:` blocks `ws:`.
- No two-browser E2E test.

## Screenshots (before)

- `screenshots/before/01-landing.png` etc. (7 files, same as `MVP_AUDIT/screenshots/strangerlink/`)
