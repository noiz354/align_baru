'use client';

/**
 * Error boundary (5xx / render failures).
 *
 * Requirements: NFR-A11Y-003/004, NFR-SEC-010 (NO internals in UI),
 * API_CONTRACT §6 (INTERNAL_* mapping).
 * Task: T-FOUND-003.
 *
 * Contract: labeled error state ("Something went wrong" + what the user
 * can do + home link); the error object is logged server-side (typed,
 * requestId present) but the UI shows NOTHING beyond the user-safe
 * message (no stacks, no storage detail — THREAT T-13).
 *
 * ── Why this file is a Client Component ──────────────────────────────────
 * Next.js requires `error.tsx` to be one: the boundary catches errors thrown
 * while rendering its subtree on the client, and it receives the `reset`
 * callback. (The skeleton shipped without the directive, which fails the
 * production build: "src/app/error.tsx must be a Client Component".)
 *
 * ── What the UI is allowed to know (NFR-SEC-010, THREAT T-13) ────────────
 * `error.digest` is the only field of the error this file touches, and it is
 * Next's opaque id for the server-side log entry — not a message, not a
 * stack, not a path. There is no `console.error` here on purpose: printing
 * the error in the browser console would put the stack and the message in
 * front of the user, which is the leak the requirement forbids, and
 * T-FOUND-008 owns the server-side logger facade anyway.
 * TODO(T-OBS-001, T-FOUND-008): log the typed AppError server-side with the
 * request id, so the digest a user is asked to quote resolves to a log line.
 *
 * TODO(T-FOUND-003): `global-error.tsx` (the boundary that replaces the root
 * layout when the layout itself throws) is not wired in this phase: it cannot
 * use AppShell, because the root layout — and with it the token and base
 * stylesheets — is gone by definition. It needs its own minimal, inlined
 * document and is called out rather than faked.
 */
import { Button } from '../shared/ui/Button';
import { FocusRegion } from '../shared/ui/FocusRegion';
import { UiLink } from '../shared/ui/Link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FocusRegion labelledBy="error-title">
      <h1 id="error-title">Something went wrong</h1>
      <p>
        This page could not be shown. Nothing was changed. Trying again often works; if it does not,
        the reader may be temporarily unavailable.
      </p>
      <p className="page-actions">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>{' '}
        <UiLink href="/">Go to the home page</UiLink>
      </p>
      {error.digest === undefined ? null : (
        <p className="note">
          Reference for the operator: <span className="num">{error.digest}</span>
        </p>
      )}
    </FocusRegion>
  );
}
