// HomeOps — E-7: a route that does not exist (DESIGN.md §11).
//
// The same surface answers "missing" and "belongs to another household": existence is never
// confirmed across the tenancy boundary (I-XA-002, docs/api/ERROR-CATALOG.md 404 row).

import { STRINGS } from '../shared/strings/en';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-text">{STRINGS.errors.notFoundTitle}</h1>
      <p className="text-sm text-text-muted">{STRINGS.errors.notFoundBody}</p>
      <a
        href="/today"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
      >
        {STRINGS.errors.backToToday}
      </a>
    </main>
  );
}
