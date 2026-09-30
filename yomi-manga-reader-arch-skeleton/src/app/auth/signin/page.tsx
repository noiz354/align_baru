/**
 * Sign in (`/auth/signin`) route shell.
 *
 * Requirements: FR-AUTH-002, NFR-A11Y-001/003/005, NFR-SEC-005.
 * Task: T-AUTH-012.
 *
 * Behavior: labeled form (email + password + reveal toggle), inline
 * errors (aria-describedby + role=alert), `?next=` sanitized to
 * same-origin relative paths only (open-redirect rule, T-AUTH-012),
 * success redirect. Uniform "invalid email or password" message.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 5: features/auth; handlers
 * `src/app/api/v1/auth/*`.
 *
 * ── `?next=` is sanitized HERE, not in the island ─────────────────────────
 * The island receives an already-safe destination (`initialNext`), so a
 * shared link can never plant an unsurfaced redirect: even a compromised or
 * outdated island bundle cannot navigate anywhere the server did not allow.
 * The rule itself lives in `./sanitize-next` (pure, UNIT-AUTH-004) and the
 * fallback is the member shelf, never an error.
 *
 * `metadata.robots` is not set here: a sign-in page has nothing to gain from
 * indexing, but nothing harmful either, and the rule belongs to whoever owns
 * the deployment's robots policy. Recorded rather than decided.
 */
import type { Metadata } from 'next';
import { SignInForm } from './signin-form';
import { sanitizeNextParam } from './sanitize-next';

export const metadata: Metadata = {
  title: 'Sign in',
};

/** `searchParams` is a promise in Next 16, and `next` may arrive as an array. */
type SearchParams = {
  next?: string | string[];
};

function readNext(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return sanitizeNextParam(undefined);
  return sanitizeNextParam(raw);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const initialNext = readNext((await searchParams).next);

  return (
    <>
      <h1>Sign in</h1>
      <SignInForm initialNext={initialNext} />
    </>
  );
}
