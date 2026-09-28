# StrangerLink Wave3 RUNTIME_PROOF

**Environment:** project `strangerlink-random-chat-webrtc-spec`, Node 22.22.3, `npm run realtime` → `[realtime] listening on port 3001`; Next 15.4.6 UI Ready 1120ms at `http://localhost:3108` (`GET /chat/<session>` 200; compiled `/chat/[sessionId]` 592ms). Runtime harness: `npm run test:wave3-audio` (`tsx scripts/wave3-audio-e2e.mjs`) uses `@roamhq/wrtc` native libwebrtc `RTCAudioSource`, `ws` package, and *the actual* server queue/matchmaking/signaling on `ws://127.0.0.1:3001`. No fake/mocked signaling server.

## Audio session exact proof

- `session_id` **`01a0e6c7-bc08-7008-a54d-feff1269410b`** (server `MATCH_FOUND`, mode `TEXT_AUDIO`)
- `peer A` **`a6191e19-bf36-4100-a8d5-44f9d8dfe886`**, role `A`, `RTCPeerConnection.connectionState=connected`, `iceConnectionState=connected`, 1 offer + 1 answer exchanged, remote `audio` track event received (`remoteAudioTrack=true`), candidate types `host, host, host`
- `peer B` **`c88ccb65-4e62-4103-8652-615229e2474c`**, role `B`, `connectionState=connected`, `iceConnectionState=completed/connected`, 1 offer + 1 answer exchanged, remote `audio` track event received, candidate types `host, host, host`
- local source both peers: `nonstandard.RTCAudioSource` 16-bit PCM 48kHz mono 10ms frames at 440Hz synthetic tone; each track added to a real peer connection. Peer A and B actual SDP/ICE passed via the live signaling WebSocket (`JOIN_QUEUE → MATCH_FOUND → OFFER → ANSWER → ICE_CANDIDATE`). Server opaque-relay path used; no direct in-process peer shortcut.
- candidate path: host candidates only (same sandbox host/direct ICE); no `relay` candidate. No coturn configured and external NAT/TURN relay not verified.

## Disconnect + moderation/report path

After both peers `connected` + remote audio track:

1. Peer B WebSocket closes normally `1000 wave3-peer-disconnect`.
2. Peer A receives real server `PEER_LEFT {reasonClass:"transport-lost"}` (`PEER_DISCONNECT` line from harness).
3. Peer A sends `REPORT_SUBMITTED {category:"other",note:"wave3 runtime verification"}` on session.
4. Server report service validates participant/session, creates server-side `reportStore` record and `moderationStore` case, then ACKs `{category:"other",note:null,reportId:"01a0e6c7-bc2d-74f5-a804-0835f92eb431",received:true}` and terminates session. No confidential moderation reasoning returned.

The report/case live in singleton in-memory server stores only; this proves server-side record/queue creation while the server lives, **not** restart durability. No report note in logs; report IDs are pseudonymous.

### Block path (same real signaling server)

A second live matched TEXT session exercised `BLOCK_CREATED` with `scope:"session"`:

- Session `01a0e6c7-bc33-714d-a464-4d71c0002585`; blocker `3549615d-4533-4888-a0cd-f50334584b4e`; blocked peer `0f01aca2-e049-45f8-be10-f7ab5805f012`.
- Blocker received `SESSION_ENDED {endReason:"block", requeueOffered:true}`; peer received `PEER_LEFT {reasonClass:"blocked"}`.
- Block records use in-memory stores; this run proves session termination and peer notification, not persistence across server restart.

## Negative paths (actual runtime)

- **Malformed signaling envelope:** valid WS identity sends `OFFER` without required `restart` field → server schema responds `ERROR VALIDATION_FAILED`; harness output `NEGATIVE_SIGNALING ["VALIDATION_FAILED", ...]`.
- **Invalid/expired-session boundary:** valid-shaped `OFFER` against unknown session UUID → server `ERROR NOT_IN_SESSION`; no relay, no peer mutation.
- **Microphone permission denied:** runtime injected browser API `getUserMedia()` throws `DOMException NotAllowedError` → coordinator result `permission-denied` (`NEGATIVE_PERMISSION permission-denied`). No synthetic fallback runs; synthetic audio is a distinct explicit test-button path.
- **Disconnect:** real peer socket close → peer receives `PEER_LEFT transport-lost`; UI `closeRtc()` closes peer and stops media tracks on local exit.

## TEXT regression (actual signaling server)

- `session_id` **`01a0e67c-e61e-727b-a1b9-faf2182b076c`**, mode `TEXT`
- A → B `MESSAGE_DELIVERED "wave3-text-a-to-b"`
- B → A `MESSAGE_DELIVERED "wave3-text-b-to-a"`
- B socket close → A `PEER_LEFT {reasonClass:"transport-lost"}`
- The AUDIO slice did not replace the existing TEXT queue/chat/signaling path.

## App/static tests

- `npm run typecheck` → pass (including `/chat/[sessionId]` WebRTC client compilation)
- `npm test` → **10 test files / 85 tests passed**, including realtime signaling 8, media 6, report 13.
- UI `GET /chat/01a0e67a-eb23-7328-aa4d-7f539fc38164` → HTTP 200, Next route compiled. Automated browser screenshot not available: Playwright Chromium download failed at `cdn.playwright.dev` with `ECONNRESET`; therefore no screenshot was substituted with generated/decorative imagery. `screenshots/README.md` documents this limitation.
