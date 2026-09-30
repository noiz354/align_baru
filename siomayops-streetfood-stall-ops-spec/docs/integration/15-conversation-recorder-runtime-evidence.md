# Page 15 — Conversation recorder runtime evidence

**Run date:** 2026-09-30 (Asia/Jakarta)
**Outcome:** The informational unavailable page builds and serves. No recording, upload, transcript, linkage or analytics flow was exercised because current policy prohibits microphone access. **Canonical Page 15 remains NOT DONE.**

## Commands and checks

| Command/check | Result |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASS; dependencies were absent after workspace hydration, lockfile install completed. |
| `corepack pnpm typecheck` | PASS (`tsc --noEmit`). An initial check identified the missing `@types/react-dom` declaration for the server-render UI test; added the matching dev type package and re-ran successfully. |
| `corepack pnpm exec vitest run tests/unit/conversation-recorder-availability.test.tsx` | PASS — 1 file, 1 test. Static render includes the explicit policy message and contains no audio/video/form/file/button controls. |
| `corepack pnpm test` | PASS — 44 files, 213 tests. |
| `corepack pnpm lint` | PASS (ESLint exit 0). Existing config warns that the Next.js ESLint plugin was not detected during production build. |
| `corepack pnpm build` | PASS — Next.js 15.4.2 static generation includes `/operator/recordings/new`. |
| `corepack pnpm check:docs` | FAIL — dangling ground-truth refs for pages 01–04, 16 and 17. No missing Page 15 artifact is reported. |
| `corepack pnpm check:stubs` | FAIL — repository-wide Phase 0 policy expects active app/domain functions to be `NotImplemented` stubs; numerous existing routes/services fail. No misleading stub was added to hide the result. |

## Local HTTP smoke

Started `corepack pnpm exec next dev --hostname 0.0.0.0 --port 3000` and requested:

```sh
curl -sS -D /tmp/page15-headers.txt -o /tmp/page15.html \
  http://127.0.0.1:3000/operator/recordings/new
```

Observed `HTTP/1.1 200 OK` and `Permissions-Policy: geolocation=(), camera=(), microphone=()`. A response-body check passed for the unavailable message, microphone-denial explanation, and absence of `<audio>`, `<form>`, and file-input elements. The route is a server-rendered informational page with no client recorder component or audio API call.

This does not prove a participant-consent workflow, recording, upload, transcription, incident linkage, or browser interaction. No recording APIs exist to authenticate against or mutate. No database record exists to reload/restart; persistence proof is not applicable because capture is prohibited. No recorder analytics event was emitted, deliberately.

## Not performed / acceptance still blocked

- No real microphone permission request or audio capture was attempted; policy and response header deny it.
- No Playwright/browser console test was run. The unit test inspects server-rendered markup and the smoke test checks the actual HTTP response/header only.
- No authenticated recording read/write, consent submission, upload, transcription job, retention choice, purge, cross-scope recording lookup, or media deletion can be tested because those boundaries/models are absent.
- No production auth, durable recording store, approved audio retention schedule, transcription processor, DPIA, legal basis, worker/non-coercion safeguards, or verified primary/backup deletion controls were demonstrated.
- Required event families (`recording_started`, `recording_stopped`, `recording_uploaded`, `transcription_completed`, `recording_linked`) are intentionally not emitted.

The `SiomayOps preview` development server is running for inspection of the informational route. It uses the repository's development environment; it is not a production service or a browser acceptance result.
