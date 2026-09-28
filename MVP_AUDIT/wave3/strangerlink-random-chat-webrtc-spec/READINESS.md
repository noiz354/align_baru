# StrangerLink Wave3 READINESS

**Wave2:** `MVP_PARTIAL` (df0e396) — real queue/matchmaking/bidirectional TEXT/PEER_LEFT; WebRTC offer/answer/ICE relay existed but not attached to chat media.

**Wave3:** `MVP_PARTIAL` (no promotion)

**New runtime-proven boundary:** matched two-peer `TEXT_AUDIO` creates real peer connections with 440Hz synthetic audio tracks, SDP offer/answer and ICE candidates relayed through the live WebSocket signaling server; both peers connect and receive remote audio tracks. Actual disconnect produces `PEER_LEFT`. A report creates a server-side case, and a second matched TEXT session exercises blocking (`SESSION_ENDED endReason:"block"` plus peer `PEER_LEFT reasonClass:"blocked"`). TEXT regression remains working. Runtime ids/results are in `RUNTIME_PROOF.md`.

**Why not MVP_READY:** runtime validation used native `@roamhq/wrtc` peer connections and host-only candidates. A real browser microphone/permission flow plus coturn/TURN relay on public NAT is not end-to-end verified. Production media usability and relay traversal remain unproven. The explicit synthetic test path cannot stand in for a real microphone in readiness classification.

- Browser coordinator returns permission-denied honestly; explicit synthetic 440Hz stream control for dev/proof; current app attaches remote track and stops tracks on leave.
- Native runtime harness: offer/answer/ICE, host direct ICE, both remote audio tracks, connected on both sides.
- Failure paths: invalid envelope `VALIDATION_FAILED`, unknown session `NOT_IN_SESSION`, denied microphone `permission-denied`, actual `PEER_LEFT transport-lost`.
- Existing TEXT flow re-run after audio additions (same runtime server).
- Report path creates an in-memory report+moderation case; block path ends the active session and notifies the peer. Both use in-memory stores and are **not durable across server restart**. No persistence claim.

**Evidence:** `MVP_AUDIT/wave3/strangerlink-random-chat-webrtc-spec/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md,screenshots/README.md}` + reproducible script `strangerlink-random-chat-webrtc-spec/scripts/wave3-audio-e2e.mjs` (requires realtime server at `ws://127.0.0.1:3001`).

**Implementation commits:** `431bd2c` matched-peer audio and `df566fb` end-to-end report/block proof.
