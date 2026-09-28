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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 5: features/auth.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Register',
};

export default function RegisterPage() {
  return (
    <>
      <h1>Create an account</h1>
      <NotYetBuilt
        headingId="auth-register-not-built"
        task="T-AUTH-012"
        intent="let a reader create an account"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-AUTH-012): register form (labeled, policy hints, a11y) */}
    </>
  );
}
