/**
 * Register (`/auth/register`) route shell.
 *
 * Requirements: FR-AUTH-001, NFR-A11Y-001/003/005, NFR-SEC-005.
 * Task: T-AUTH-012.
 *
 * Behavior: labeled form (email, password + policy hint via
 * aria-describedby, display name optional); policy errors inline;
 * duplicate email → 409 message; auto-login on success. The `role`
 * field does not exist in this form (THREAT T-07). No feature code.
 */
export default function RegisterPage() {
  return (
    <main>
      {/* TODO(T-AUTH-012): register form (labeled, policy hints, a11y) */}
    </main>
  );
}
