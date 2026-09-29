'use client';

/**
 * SignInForm — the credential form, the states, and the post-login navigation.
 *
 * Requirements: FR-AUTH-002, NFR-A11Y-001/003/005, NFR-SEC-005.
 * Task: T-AUTH-012.
 *
 * ── Why a client island on a server shell ─────────────────────────────────
 * The page (`page.tsx`) reads `?next=` on the server and sanitizes it there,
 * so a shared link can never plant an unsurfaced destination. The credential
 * exchange itself is client state — typing, a reveal toggle, a submission in
 * flight — posted as JSON to the login route the API already owns
 * (`POST /api/auth/login`). The route sets the `session_token` cookie on its
 * response (same-origin fetch, so the browser stores it); success navigates
 * to `next` and refreshes, which is what picks the session up server-side.
 *
 * ── Error discipline ──────────────────────────────────────────────────────
 * 401 carries the route's uniform "Invalid credentials" for both "no such
 * account" and "wrong password" (the route verifies a dummy hash for unknown
 * emails, so timing does not distinguish them either — that guarantee is
 * broken if this form ever renders two messages here). 403 is the route's
 * deliberate separate answer ("Account disabled") and is shown verbatim; it
 * is reachable only with the right password, so it leaks nothing. Anything
 * else — including a network failure — is one retryable sentence.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 * `FormField` (shared/ui) owns the label/hint/error wiring: visible labels,
 * `aria-describedby`, `role="alert"` errors, `aria-invalid`. Native
 * validation stays on (no `noValidate`); the submit button disables while
 * the exchange is in flight so a double submit is impossible.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../shared/ui/Button';
import { FormField } from '../../../shared/ui/FormField';
import styles from './signin.module.css';

/** The uniform authentication failure: account and password are indistinguishable. */
export const SIGNIN_INVALID_MESSAGE = 'Invalid email or password.';

/** The retryable failure: the exchange itself did not complete. */
export const SIGNIN_RETRY_MESSAGE = 'Sign-in failed. Check your connection and try again.';

export type SignInFormProps = {
  /** The sanitized `?next=` destination — the page, not the island, owns the rule. */
  initialNext: string;
};

type Status = { name: 'idle' } | { name: 'submitting' } | { name: 'error'; message: string };

export function SignInForm({ initialNext }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<Status>({ name: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.name === 'submitting') return;
    setStatus({ name: 'submitting' });
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      setStatus({ name: 'error', message: SIGNIN_RETRY_MESSAGE });
      return;
    }
    if (response.ok) {
      // `push` alone: an App Router navigation re-renders server components
      // on the new route, which is what picks the fresh session cookie up. A
      // `refresh()` here would race the push and revalidate the sign-in page
      // instead — the shelf would render signed-out on a valid session.
      router.push(initialNext);
      return;
    }
    if (response.status === 401) {
      setStatus({ name: 'error', message: SIGNIN_INVALID_MESSAGE });
      return;
    }
    if (response.status === 403) {
      // The route's deliberate separate answer; shown verbatim (see header).
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
      } | null;
      const message = body?.error?.message;
      setStatus({
        name: 'error',
        message: typeof message === 'string' && message !== '' ? message : SIGNIN_INVALID_MESSAGE,
      });
      return;
    }
    setStatus({ name: 'error', message: SIGNIN_RETRY_MESSAGE });
  }

  const busy = status.name === 'submitting';

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      <FormField
        id="signin-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormField
        id="signin-password"
        label="Password"
        type={revealed ? 'text' : 'password'}
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label className={styles.reveal} htmlFor="signin-reveal">
        <input
          id="signin-reveal"
          type="checkbox"
          checked={revealed}
          onChange={(event) => setRevealed(event.target.checked)}
        />
        Show password
      </label>
      {status.name === 'error' ? (
        <p className={styles.error} role="alert">
          {status.message}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
