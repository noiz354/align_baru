# Fakes (unit-layer test doubles)

A fake is a deliberate, documented substitute - never a mock of the thing being tested
(`TESTING.md` §1: a test that passes with a stub of the constrained behaviour is worse than no test).

| Fake | Stands in for | Used by | Must not be used to |
|---|---|---|---|
| `clock.ts` | `Clock` | domain and application unit tests | decide a window/retention outcome that is then asserted as correct in an integration test |
| `tokenService.ts` | `TokenService` | application tests that do not test token properties | assert token entropy or payload properties (those use the real service) |
| `queue.ts` | `QueuePort` | application tests of enqueue decisions | assert job convergence (that needs real Postgres, C11) |
| `storage.ts` | `StoragePort` | chunk/assembly decision tests | assert durability semantics |
| `transcriptionProvider.ts` | `TranscriptionProvider` | orchestration and failure-classification tests | assert that text is preserved verbatim (that is a pipeline test) |

Rules: fakes live here, are typed against the real port, and are reviewed when the port changes.
`tests/support/fakes/index.ts` exports them; implementation belongs to T-TEST-001/T-TEST-002.
