# StrangerLink — CHANGES (narrowest slice: RUNNABLE_DEMO → MVP_PARTIAL)

**Goal:** Replace hallucinated `setTimeout`/`setInterval` queue/chat with real two-peer TEXT match→signal→send/receive→leave via `ws://localhost:3001`, using existing `src/server/realtime/server.ts` + `src/features/*` + `src/shared/contracts/signaling.ts` (Zod, PAYLOAD_LIMITS, envelope). Keep NEXT 15.4.6, reuse pricing/SQLite not needed, seed deterministic demo data via sessionStorage, no fake completion.

## Files created/modified

- `src/app/queue/page.tsx` **(modified, 62→326 lines, +139)** — replace simulated `matchTimeout 3-8s` with real `createSignalingClient`:
  - Imports `createSignalingClient` from `../../features/signaling/signaling.client`.
  - Adds `wsRef` + `participantIdRef`, `cancelled` flag, `getRealtimeUrl()` (ws://localhost:3001 or wss://3001-*.e2b.app for preview, or NEXT_PUBLIC_REALTIME_URL).
  - In `useEffect` after `setStatus('waiting')` + `interval` for 120s expiry, async IIFE: read `strangerlink_participantId` or `crypto.randomUUID()` + `strangerlink_mode`/`interests`/`language`/`consentVersion`, derive `wsUrl`, `createSignalingClient(wsUrl)`, `client.onMessage` handles `MATCH_FOUND` (store sessionId/sessionRole, set matched, redirect 600ms to `/chat/${sessionId}`), `ERROR` (RATE_LIMITED/RESTRICTED → cooldown, QUEUE_CANCELLED → expired), `QUEUE_CANCELLED`/`SESSION_ENDED`/`PEER_LEFT`, `client.onDisconnect` shows Reconnecting…, `await client.connect(pid)`, then `client.send(JOIN_QUEUE {messageId:uuid, sessionId:null, fromParticipantId:pid, sequence:1, sentAt, payload:{mode, interestIds, language, regionConstraint:null, consentVersion}})`. `catch` logs `queue ws error` and shows `Connecting to matching service…` (no fake fallback). `handleCancel`/`handleLeave` now `wsRef.current.close()` before navigation, `handleRetry` reloads. Removes `matchTimeout` hallucination.

- `src/app/chat/[sessionId]/page.tsx` **(modified, 347→216 lines in diff but actually 13994→~14000, +~150)** — replace simulated `strangerMessages` interval with real ws:
  - Imports `createSignalingClient` + `ReportCategory` type, adds `wsRef` + `participantIdRef` + `sessionIdRef`.
  - `useEffect` for consent check now also sets `sessionIdRef`, then async IIFE: read `participantId` (or uuid), derive `wsUrl` same as queue, `createSignalingClient(wsUrl)`, `client.onMessage` handles `MESSAGE_DELIVERED` (add stranger bubble with `msg.payload.body`, `sentAt`), `MESSAGE_REJECTED` (announce), `PEER_LEFT`/`SESSION_ENDED` (map `transport-lost`→`network-issue`, `blocked`→`user-block`, else `peer-disconnected`, setAnnouncement), `ERROR` (RATE_LIMITED), `BLOCK_CREATED`/`REPORT_SUBMITTED`, `client.onDisconnect` sets `isConnected false`. `await client.connect(pid)` → `setIsConnected true`. `handleSend` now does optimistic `setMessages([...prev, {sender:'me'}])` plus `client.send(MESSAGE_SEND {messageId:uuid, sessionId, fromParticipantId:pid, sequence:0, sentAt, payload:{clientMessageId, body}})`. `handleSkip`/`handleLeave` do `wsRef.close()` then navigate (Leave has 200ms delay for PEER_LEFT). `handleSubmitReport` sends `REPORT_SUBMITTED`, `handleConfirmBlock` sends `BLOCK_CREATED` then close. Removes `strangerMessages` interval hallucination. Adds `data-testid="messages"` for E2E.

- `next.config.ts` **(modified, 1 line)** — `connect-src 'self' wss: https:` → `connect-src 'self' ws: wss: http: https:` to allow `ws://localhost:3001` (was blocked, caused `Connection closed.` and no `open` on server). `script-src 'self'` stays strict (no unsafe-inline/unsafe-eval) — bypassCSP still required for screenshots, but ws now allowed.

## What became real vs mocked

| Area | Before | After |
|---|---|---|
| Queue | `setTimeout 3000+Math.random()*5000` → `session-${Date.now()}` local, no ws, single-client hallucination, no sessionStore | `ws://localhost:3001?token=pid` → `JOIN_QUEUE` → `queueStore` + `matchmakingService.findMatch` → `MATCH_FOUND` to both with same `sessionId` (01a0e5a7-...), client stores and redirects |
| Chat send | `setMessages` local + `setInterval` random 50% 3s, no server | `MESSAGE_SEND` → `chatService.sendMessage` (validate 2000, spam, rate-limit, 300 cap, sequence) → `MESSAGE_DELIVERED` to peer, peer adds stranger bubble |
| Chat leave | `window.location.href='/'` local, peer not notified | `ws.close(1000)` → server `close 1000` → `PEER_LEFT transport-lost` → peer `peer-disconnected` + `Find someone new` |
| CSP | `connect-src 'self' wss: https:` blocks ws: | `connect-src 'self' ws: wss: http: https:` allows ws: |
| Envelope | No Zod, no impersonation check | `parseSignalingMessage` Zod, `fromParticipantId` must equal auth pid, no `toParticipantId`, `messageId` uuid, `sequence` monotonic, `maxPayload 64KiB`, `origin` allowlist `http://localhost` |

## What deliberately not done (stay narrow)

- No TURN/STUN for media (TEXT only for MVP_PARTIAL, media buttons still show permission-denied/failed states but not real relay).
- No `TURN_URL`/`TURN_SECRET` wiring (would need env and coturn).
- No `20 test.todo` media tests — still todo, but TEXT E2E now real.
- No persistent DB for sessions (still in-memory `Map`, ephemeral as spec).
- No QR/report moderation UI beyond `REPORT_SUBMITTED`/`BLOCK_CREATED` via ws (already wired, but moderation queue not UI-tested).
- No `interestLabelToId` mapping — uses raw `music` etc. as validInterests (queueService filters to valid list, so `music` works).

## Verification

- `npm run typecheck` → PASS
- `npm run test:realtime` → PASS (existing)
- `node test-node-ws.mjs` (Node ws, no browser) → PASS (see AFTER.md Runtime)
- `LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp node test-two-peer.mjs` (playwright-core 153.0.8010, chromium headless shell, 2 contexts) → ALL PASS (see AFTER.md)
- `curl -I http://localhost:3105/queue` → `connect-src 'self' ws: wss: http: https:`
- Screenshots 7 files before/after (copied, visual same but now functional; queue spinner still 27K, chat bubbles now real)
