# StrangerLink Wave3 IMPLEMENTATION

**Narrow fix:** wire the already existing media and signaling abstractions into the real matched StrangerLink chat; no video/TURN feature expansion.

## Changed files

- `src/app/chat/[sessionId]/page.tsx` — matched-session audio path now creates a real browser `RTCPeerConnection` only after explicit audio click. `Mic` requests `getUserMedia({audio:true})` from click gesture; `Synthetic Audio Test` uses an explicit local Web Audio oscillator (440Hz), never substitutes for denied microphone permission. Each local track is added to the connection. Role A sends SDP `OFFER` over the existing `createSignalingClient` channel; role B processes `OFFER`, creates `ANSWER`; both relay ICE candidates via existing `OFFER/ANSWER/ICE_CANDIDATE` envelopes. Incoming early offers/candidates are buffered until peer clicks audio; duplicate offers ignored. Both set remote description/ICE; `ontrack` attaches remote audio stream to hidden autoplay `<audio>`. `connectionState`/`iceConnectionState` set `connected`/`disconnected`; UI surfaces counts and candidate types. `closeRtc()` stops local/remote tracks, oscillator and AudioContext on leave/skip/report/block/unmount. Audio controls disabled in TEXT mode (consent selected mode enforced).

- `src/features/media/peer-connection.coordinator.ts` — reusable `createSyntheticAudioStream()` generates a 440Hz WebAudio audio `MediaStream` for an explicit test control; coordinator still returns `permission-denied`/`no-device` honestly and never silently replaces microphone denial with synthetic audio. Test source refs (oscillator/context) retained and explicitly cleaned up.

- `src/server/realtime/server.ts` — report acknowledgement now includes stable `reportId` and `{received:true}`. Report remains server-side; response still exposes no moderation reasoning. Existing `reportsService.submitReport` writes to `reportStore`, creates a moderation case in `moderationStore`, dedupes by `(sessionId,category)`, and terminates session.

- `scripts/wave3-audio-e2e.mjs` — executable `@roamhq/wrtc` native libwebrtc E2E harness: two real `RTCPeerConnection`s with synthetic 440Hz `RTCAudioSource` tracks connect through actual WebSocket queue/matchmaking/signaling server; validates offer/answer/ICE, remote audio tracks, disconnect, report ACK, malformed signaling, invalid session, permission denial. Start `npm run realtime` in another shell, then `npm run test:wave3-audio`.

- `package.json` / lock — dev dependency `@roamhq/wrtc` only for reproducible native WebRTC runtime harness and `test:wave3-audio` script.

## Reused boundaries

- Existing `src/server/realtime/server.ts` opaque `OFFER`, `ANSWER`, `ICE_CANDIDATE` relay (server doesn't parse SDP), matchmaker and session store.
- Existing `src/features/signaling/signaling.client.ts` WebSocket transport.
- Existing `src/features/reports/reports.service.ts` + `reportStore` + `moderationStore` (runtime in-memory; no new persistence claim).
- Synthetic test audio is local-only explicitly selected; app's production Mic button still uses browser microphone and explicit permission prompt.

## Limitations (important)

- Runtime two-peer WebRTC proof used two native `@roamhq/wrtc` peer connections with the real WebSocket signaling service; it is not a real-model/browser microphone test. UI route compiles and is wired but no Chromium binary was available to capture a browser screenshot/automate permission UI.
- Candidates were `host` direct candidates; no `coturn`/TURN relay configured, so public-NAT traversal not proven. Media permission denial was tested via a runtime fake `getUserMedia` rejection and returned `permission-denied`.
- Reports/moderation cases are in the current server process's in-memory `reportStore`/`moderationStore`, not durable across restart. Wave3 verifies server-created report ID/case path but does not claim durable safety queue; durable moderation storage remains a blocker.

Implementation commits: `431bd2c feat(strangerlink): attach real audio to peer sessions`; `df566fb test(strangerlink): verify matched-session reporting and blocking`.
