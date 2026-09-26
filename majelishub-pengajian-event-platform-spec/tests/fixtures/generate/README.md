# Fixture generators

Scripts that build large or derived fixtures so the repository stays small:

- `make-long-audio.mjs` - concatenates the 30 s synthetic speech fixture into a 2-hour file with a known
  chunk boundary map (used for assembly and recovery tests).
- `make-qr-video.mjs` - renders QR codes into a video with brightness/angle variation for the scanner
  fixture.
- `make-transcript.mjs` - emits a 1,500-segment transcript with Arabic spans and uncertainty markers.
- `make-event-L.mjs` - seeds the 320-registration dataset used by load and entrance-drill tests.

Rules: every generator is deterministic (fixed seed), documented, and never downloads third-party
content at test time. Implementation belongs to T-TEST-002 (fixtures and seeds).
