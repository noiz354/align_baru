# MVP Matrix — Wave 3 (2026-09-28, Asia/Jakarta)

Branch: `arena/01a0e54f-align-baru`
Base: `df0e396`
Scope: narrow evidence-backed changes across all eight projects. Runtime data is not committed; screenshot assets are included only where actual captures exist. Each project's implementation is committed separately from its Wave3 evidence.

| Project | Wave3 status | Proven boundary | Explicit limitation | Implementation commit |
|---|---|---|---|---|
| `parking-attendant-ops-app-spec` | **MVP_READY** (retained) | Concurrent checkout/replay converges to one finalized stay, fee, cash payment, receipt, outbox event and audit entry; restart and audit-chain/reconciliation checks are documented. | QRIS remains fail-closed without provider settlement; no production PSP claim. | `d498bc9` |
| `manga-reader-spec-skeleton-minimal` | **MVP_PARTIAL** (retained) | Authenticated per-user reading progress, A/B isolation, logout/login and restart restore; page bounds follow seeded chapter range. | No broad admin/upload system; wider catalog and publishing scope remains incomplete. | `0fd4b3b` |
| `siomayops-streetfood-stall-ops-spec` | **MVP_PARTIAL** (retained) | Signed payment callback handles invalid HMAC, unknown reference, mismatch, replay, concurrency and restart; cash sale remains server-recorded. | Development callback contract only; no live PSP settlement or broad operational-readiness claim. | `4687da3` |
| `strangerlink-random-chat-webrtc-spec` | **MVP_PARTIAL** (retained) | Real two-peer audio offer/answer/ICE and remote tracks over the live signaling server; server-side report and block paths exercised. | Native synthetic audio and host ICE only; browser microphone/public TURN traversal and moderation persistence are unverified. | `431bd2c`, `df566fb` |
| `rsi-agent-recursive-self-improvement-prototype` | **MVP_PARTIAL** (retained) | Disposable-repository task→provider-contract→verifier→guards→human approval→apply→test→audit→rollback; exact original tree hash restored. | OpenAI-compatible local mock proves provider contract, not a live LLM call; no live credentials used. | `3fc515c` |
| `yomi-manga-reader-arch-skeleton` | **MVP_PARTIAL** | Authenticated user-owned library, bookmarks, and progress survive logout/login and restart; A/B state is isolated. | Search/admin upload/production object storage and the wider product roadmap remain incomplete. | `b4ebebe` |
| `majelishub-pengajian-event-platform-spec` | **MVP_PARTIAL** | Registration capability and idempotent attendance logic; protected organization, mosque, summary and check-in routes fail closed against spoofed identity. | PGlite cannot authenticate through Better Auth's PostgreSQL adapter; successful signed-in route execution and device binding remain unverified. Volunteers remain denied until a verified device binding exists. | `5f52802` |
| `homeops-household-manager-spec` | **MVP_PARTIAL** | Durable recurring chore occurrence creation/completion, deterministic dedupe and restart restore. | Trash, resources, maintenance, notifications, alerts and scheduler remain outside the implemented slice. | `eb4fadd` |

## Verification snapshot

- MajelisHub: after the final route/audit identity changes, `npm test` reported **125 passed, 281 todo** (20 files passed, 77 skipped); `npm run typecheck` passed. The fresh PGlite unauthenticated regression returned HTTP 401 for organization list, mosque list, check-in summary and check-in validation, including spoofed identity header/query values. This is not a logged-in route proof.
- StrangerLink: `npm run typecheck` passed; `npm test` reported **85 passed**. The Wave3 native harness additionally proved connected peers/remote audio tracks, report acknowledgement, block termination/peer notification, and negative signaling/media-permission paths against the live signaling server.
- Project-specific tests/runtime commands and exact evidence are recorded in `MVP_AUDIT/wave3/<project>/`.

**Current readiness totals:** 1 `MVP_READY`, 7 `MVP_PARTIAL`, 0 `RUNNABLE_DEMO`.
