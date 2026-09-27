'use client';

// HomeOps — route-level error boundary (T-PLAT-002, DESIGN.md §11 E-5).
//
// Honest failure: apologetic, actionable, and it carries a short reference a member can read back.
// No stack trace, internal message, or SQL ever reaches this surface (SECURITY.md §5); the digest is
// the correlation key the server log already holds.

import { STRINGS } from '../shared/strings/en';

type ErrorProps = {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
};

export default function RouteError({ error, reset }: ErrorProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-text">{STRINGS.errors.unexpectedTitle}</h1>
      <p className="text-sm text-text-muted">{STRINGS.errors.unexpectedBody}</p>
      {error.digest ? (
        <p className="text-xs text-text-muted">
          {STRINGS.errors.referenceLabel}: <span className="font-mono">{error.digest.slice(0, 12)}</span>
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          {STRINGS.errors.retry}
        </button>
        <a
          href="/today"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-text"
        >
          {STRINGS.errors.backToToday}
        </a>
      </div>
    </main>
  );
}
