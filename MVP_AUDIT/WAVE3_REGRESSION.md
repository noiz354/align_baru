# Wave3 Regression and Boundary Proof

Date: 2026-09-28 (Asia/Jakarta)
Branch: `arena/01a0e54f-align-baru`
Baseline: `df0e396`

This records the narrow Wave3 proof per project. It is not a blanket production-readiness certification. Runtime details and reproducible commands live in `MVP_AUDIT/wave3/<project>/`.

| Project | Wave3 proof | Boundary / remaining limitation |
|---|---|---|
| **HomeOps** | DAILY/WEEKLY occurrences use deterministic household-scoped keys; completing an occurrence creates the next due occurrence exactly once. Wrong-household and invalid requests fail closed; PGlite restart preserves state. | Other household domains and a scheduler/alerts are not implemented. |
| **MajelisHub** | No-session requests to organization list, mosque list, check-in summary and check-in validation all returned `401 UNAUTHENTICATED`, even with forged `x-majelishub-user` / `userId` query identity. Routes now use the session actor for access and audit identity. | PGlite's Better Auth adapter requires PostgreSQL; successful signed-in route execution is unverified. No real volunteer device-binding flow exists, so volunteers remain denied. Older positive route results are historical and predate these gates. |
| **Minimal reader** | User A and B retain distinct progress; unauthenticated access fails, invalid page indexes are rejected, and logout/login plus restart preserve each user's own state. | No broad catalog-admin or upload scope was added. |
| **Parking** | Concurrent/replayed checkout of the same stay produces one finalized stay, fee, payment, receipt, outbox event and audit record. Restart, hash-chain verification and reconciliation are covered by the project runtime proof. | QRIS settlement remains fail-closed without a provider callback. |
| **RSI prototype** | Disposable Git repository exercises the bounded improvement lifecycle through a local OpenAI-compatible provider-contract mock, verifier/guards, named approval, application, tests, audit and exact-tree rollback. | This is not a live LLM run; no live provider credentials or real model response are claimed. |
| **SiomayOps** | Signed callback proof covers invalid HMAC, unknown reference, replay/concurrency, amount mismatch and restart; paid state is never set by UI. Cash sale tests cover duplicate sale/stock movement. | Development callback contract only; no live PSP settlement claim. |
| **StrangerLink** | Live signaling server: two peers exchange SDP offer/answer/ICE, both connect and receive synthetic remote audio tracks; disconnect, moderation report acknowledgement, matched-session block termination/peer notification and negative signaling/permission paths are exercised. | Host ICE and synthetic native media only; browser microphone flow, coturn/public TURN, and durable moderation storage are not verified. |
| **Yomi** | User-owned library/bookmarks/progress are isolated and survive logout/login and application restart; seeded chapter bounds are enforced. | Wider search/admin upload and production object-storage requirements remain incomplete. |

## Checks rerun while preparing the PR

- MajelisHub: `npm test` — **125 passed, 281 todo** (20 files passed, 77 skipped); `npm run typecheck` passed. A clean npm install exposed an out-of-sync lockfile, which was refreshed before rerunning tests/typecheck.
- StrangerLink: `npm run test:wave3-audio` against the live realtime server — audio offer/answer/ICE and remote tracks connected; report acknowledged; block ended the session and notified its peer; malformed/unknown signaling and microphone permission denial were rejected. `npm run typecheck` passed; `npm test` — **85 passed**.
- Parking: `python3 -m unittest discover -s tests` — **66 passed**.
- RSI: `python3 -m unittest discover -s tests` — **147 passed, 1 skipped**.
- Minimal reader: `npm test` — **15 passed**.

The project READINESS/RUNTIME_PROOF files contain earlier per-project test and runtime results; those are not represented here as rerun in this final PR pass unless listed above.
