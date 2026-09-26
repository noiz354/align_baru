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
 * No feature code in this phase.
 */
export default function SignInPage() {
  return (
    <main>
      {/* TODO(T-AUTH-012): sign-in form (labeled, error-linked, a11y) */}
    </main>
  );
}
