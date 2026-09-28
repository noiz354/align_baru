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
 * No feature code.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 5: features/auth; handlers
 * `src/app/api/v1/auth/*`.
 *
 * `metadata.robots` is not set here: a sign-in page has nothing to gain from
 * indexing, but nothing harmful either, and the rule belongs to whoever owns
 * the deployment's robots policy. Recorded rather than decided.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function SignInPage() {
  return (
    <>
      <h1>Sign in</h1>
      <NotYetBuilt
        headingId="auth-signin-not-built"
        task="T-AUTH-012"
        intent="sign a reader in"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-AUTH-012): sign-in form (labeled, error-linked, a11y) */}
    </>
  );
}
