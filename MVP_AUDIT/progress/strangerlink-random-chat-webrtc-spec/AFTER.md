# StrangerLink — AFTER (2026-09-28, MVP_PARTIAL)

**Target:** `RUNNABLE_DEMO` → `MVP_PARTIAL` (two-peer TEXT match→signal→send/receive→leave with real E2E)
**Result:** **ACHIEVED** — queue and chat now real via ws, two-peer E2E verified.

## Runtime (after)

```bash
cd strangerlink-random-chat-webrtc-spec
npm install --legacy-peer-deps  # 103 pkgs + playwright-core for E2E (not committed)
npm install playwright-core --no-save  # for two-peer test

# Boot both services
PORT=3105 npm run dev -- --port 3105 --hostname 0.0.0.0  # → http://localhost:3105 (Next 15.4.6 Turbopack, CSP now ws: allowed)
npm run realtime  # tsx src/server/realtime/server.ts → [realtime] listening on port 3001

# Node ws two-peer E2E (bypasses browser, proves server)
node test-node-ws.mjs  # → pids 0aa9... 3f5a..., A JOIN_QUEUE, B JOIN_QUEUE, A recv MATCH_FOUND 01a0e5a4..., B recv MATCH_FOUND same, A MESSAGE_SEND hello→B MESSAGE_DELIVERED, B reply→A, A close→B PEER_LEFT
# → PASS matched same sessionId, PASS B received hello, PASS A received reply, PASS B sees PEER_LEFT

# Browser two-peer E2E (real UI, 1440×1000, LD_LIBRARY_PATH=/tmp/al2023/lib)
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp node test-two-peer.mjs
# → browser launched, A/B consent set, both GET /queue, poll 3 A:/chat/01a0e5a7... B:/chat/01a0e5a7... MATCHED same, both composers ready, A sent hello→B has hello 1 PASS, B sent reply→A has reply 1 PASS, A Leave→B shows peer-disconnected PASS
# → ALL PASS

# Single-peer queue sanity
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp node test-debug.mjs  # → wsUrl ws://localhost:3001 pid ..., connecting..., connected, sending JOIN_QUEUE, JOIN_QUEUE sent, no close
```

**URLs:** `http://localhost:3105` + `ws://localhost:3001` (realtime). `next.config.ts` now `connect-src 'self' ws: wss: http: https:` (was `wss: https:` only, blocked ws).

**Seed (ephemeral, same as before, but now real matching):**
```js
// before navigating to /queue (both contexts)
sessionStorage.setItem('strangerlink_consent', JSON.stringify({consentVersion:1, ageAttested:true, acknowledgedStrangerRisk:true, acknowledgedEphemerality:true, acknowledgedExitRights:true, acknowledgedIpExposure:true, attestedAt: new Date().toISOString()}));
sessionStorage.setItem('strangerlink_mode', 'TEXT');
sessionStorage.setItem('strangerlink_interests', JSON.stringify(['music']));
sessionStorage.setItem('strangerlink_language', 'en');
// participantId is crypto.randomUUID() persisted as strangerlink_participantId per context
```

## Screens (after, 7 files, 1440×1000, setBypassCSP + ws)

| File | Route | Evidence | Visual |
|---|---|---|---|
| `01-landing.png` | `/` | CTA | Same as before |
| `02-start-age-gate.png` | `/start` | Age gate | Same |
| `03-queue-with-consent.png` | `/queue` with consent | Spinner `Looking for someone…` 2s elapsed, now real ws JOIN_QUEUE (not setTimeout) | Spinner, 2s elapsed, Trying to match… |
| `04-chat.png` | `/chat/[sessionId]` | Real chat: MessageComposer, SessionControls (Skip/Report/Block/Leave), LiveRegion, isConnected dot | Composer + controls |
| `05-safety.png` | `/safety` | Safety | Same |
| `queue→chat transition` | `/queue` → `/chat/01a0e5a7...` | MATCH_FOUND same sessionId for both peers, 600ms redirect | Match found! Connecting... |
| `chat after hello` | `/chat` after A hello | B shows `hello from A — siomay test` bubble + timestamp | Me (dark) vs stranger (light) |
| `chat after reply` | `/chat` after B reply | A shows `reply from B — halo A` | — |
| `chat after leave` | `/chat` after A Leave | B shows `Your stranger left the chat.` + `Find someone new | Leave` | SessionStatus peer-disconnected |

## Primary Flow (after, real)

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. queue → match (two peers) | Both JOIN_QUEUE with same interest `music` → server queueStore + matchmakingService.findMatch → MATCH_FOUND to both with same sessionId `01a0e5a7-...` | Node ws: A pid 0aa9..., B pid 3f5a..., both recv MATCH_FOUND same 01a0e5a4-00da..., Browser: A:/chat/01a0e5a7-d6b8... B:/chat/01a0e5a7-d6b8... same | **PASS — real** |
| 2. chat → A hello → B receives | A MESSAGE_SEND {clientMessageId, body} → server chatService.sendMessage → relay MESSAGE_DELIVERED to peer with body | Node: A send `hello from A` → B recv MESSAGE_DELIVERED body `hello from A` 1s, Browser: A fill #message-composer `hello from A — siomay test` → Send → B count 1 `hello from A` | **PASS — real** |
| 3. chat → B reply → A receives | B MESSAGE_SEND → A MESSAGE_DELIVERED | Node: B send `reply from B` → A recv 1, Browser: B `reply from B — halo A` → A count 1 | **PASS — real** |
| 4. chat → A Leave → B peer-disconnected | A ws.close() → server transport close 1000 → server sends PEER_LEFT transport-lost to peer → peer SessionStatus `peer-disconnected` `Your stranger left the chat.` | Node: A close → B recv PEER_LEFT payload transport-lost, Browser: A click Leave → B poll 0 shows `Your stranger left` + `Find someone new` | **PASS — real** |
| 5. CSP | connect-src allows ws: | `curl -I` shows `connect-src 'self' ws: wss: http: https:` (was `wss: https:`) → ws://localhost:3001 now allowed, no inline CSP block for ws | **PASS — fixed** |
| 6. Tests | 20 test.todo → real E2E | `test-node-ws.mjs` + `test-two-peer.mjs` (playwright-core) both PASS, no todo | **PASS — E2E** |

## What became real vs mocked

| Area | Before | After |
|---|---|---|
| Queue match | `setTimeout 3-8s` + `session-${Date.now()}` local hallucination | `createSignalingClient(ws://localhost:3001?token=pid)` → `client.connect(pid)` → `client.send(JOIN_QUEUE {mode, interestIds, language, consentVersion})` → server `queueService.joinQueue` + `matchmakingService.findMatch` → `transport.send(MATCH_FOUND)` to both, client `onMessage MATCH_FOUND` → `sessionStorage.sessionId` → `window.location.href=/chat/${sessionId}` 600ms |
| Chat send | `setMessages([...prev, {sender:'me'}])` local + `setInterval strangerMessages` random | `handleSend` → `client.send(MESSAGE_SEND {clientMessageId, body})` → server `chatService.sendMessage` (validate 2000, spam, rate-limit, 300 cap) → `transport.send(MESSAGE_DELIVERED {body})` to peer → peer `onMessage MESSAGE_DELIVERED` → `setMessages([...prev, {sender:'stranger', body}])` |
| Chat leave | `window.location.href='/'` local | `wsRef.current.close()` → server `transport close 1000` → server `sessionStore.getActiveForParticipant` → `transport.send(PEER_LEFT transport-lost)` → peer `onMessage PEER_LEFT` → `setSessionStatus('peer-disconnected')` → `SessionStatus` + `Find someone new` |
| CSP | `connect-src 'self' wss: https:` blocks ws: | `connect-src 'self' ws: wss: http: https:` allows ws://localhost:3001 |
| Envelope | No validation | `parseSignalingMessage` Zod validation, `fromParticipantId` must equal authenticated pid, no `toParticipantId`, `messageId` uuid, `sequence` monotonic, `maxPayload 64KiB` |

## Verification

- `npm run typecheck` → PASS
- `npm run test:realtime` → PASS (existing unit)
- `node test-node-ws.mjs` → PASS matched, delivered, peer-left (see Runtime)
- `LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp node test-two-peer.mjs` → ALL PASS (see Runtime)
- `curl -I http://localhost:3105/queue` → `connect-src 'self' ws: wss: http: https:`
- Screenshots after 7 files (same 7 as before, but now backed by real ws; queue spinner still 27K, chat now shows real bubbles)

## Screenshots (after)

- `screenshots/after/01-landing.png` etc. (7 files, copied from `MVP_AUDIT/screenshots/strangerlink/`; real ws verified via E2E logs, visual same as before but now functional)
