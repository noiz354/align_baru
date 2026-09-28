# StrangerLink Wave3 FAILURE_CASES

## 1. Malformed signaling envelope is rejected server-side

- **Input:** authenticated WS peer sent `OFFER` with payload `{sdp:"bad"}` but omitted schema-required `restart:boolean`.
- **Observed:** real `parseSignalingMessage` → WS `ERROR {code:"VALIDATION_FAILED",message:"Invalid message",retryable:false}`; harness `NEGATIVE_SIGNALING ["VALIDATION_FAILED", ...]`.
- **Pass criterion:** malformed `OFFER` never relayed or applied to peer connection.

## 2. Unknown/expired session is not a valid signaling target

- **Input:** valid-shaped `OFFER {sdp:"v=0\\r\\n",restart:false}` against random session UUID not in `sessionStore`.
- **Observed:** server responds `ERROR NOT_IN_SESSION`; no offer reaches another peer. This proves unknown session boundary (no time-expiry cron simulation claimed).

## 3. Browser permission denial stays denied

- **Input:** coordinator `requestMedia("microphone","runtime-user-gesture")` with runtime `navigator.mediaDevices.getUserMedia` rejecting `NotAllowedError`.
- **Observed:** returns `permission-denied`; no track added, no synthetic source auto-start. Explicit synthetic audio is a separate labeled control and only runs after click in a session whose consent mode is `TEXT_AUDIO` or `TEXT_VIDEO`.

## 4. Peer disconnect closes session path

- **Input:** Peer B closes real WebSocket after `MATCH_FOUND`/WebRTC connected.
- **Observed:** Peer A receives `PEER_LEFT {reasonClass:"transport-lost"}`. Chat page clears the `RTCPeerConnection` and stops local/remote media tracks during leave/unmount.

## Safety report and block boundaries

- **Report observed:** a live peer sends `REPORT_SUBMITTED`; the server validates participation in the matched session, writes an in-memory `reportStore` record and moderation case, then acknowledges report ID `01a0e6c7-bc2d-74f5-a804-0835f92eb431` and ends the session.
- **Block observed:** blocker `3549615d-4533-4888-a0cd-f50334584b4e` sends `BLOCK_CREATED {scope:"session"}` in matched session `01a0e6c7-bc33-714d-a464-4d71c0002585`; blocker receives `SESSION_ENDED {endReason:"block"}`, peer `0f01aca2-e049-45f8-be10-f7ab5805f012` receives `PEER_LEFT {reasonClass:"blocked"}`.
- Report and block state use process-memory stores; no persistence across restart is claimed.

**Strongest failure-path result:** malformed media envelope → live signaling server `VALIDATION_FAILED`; unknown session → `NOT_IN_SESSION`; permission denial → `permission-denied`; block terminates a real matched session and notifies its peer.
