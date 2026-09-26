// HomeOps - route skeleton (specification phase). No page is implemented.

/**
 * /invite/[token] - Accept invitation
 *
 * Shows the household name, who invited them, and the role on offer. The token is single-use and
 * expires after 7 days; expired and already-used cases are distinct, honest states (INVITE_EXPIRED,
 * INVITE_ALREADY_USED).
 *
 * Contract: docs/design/PAGES.md. Owning task: T-MEM-002.
 * Returns null by design: no production UI exists in this phase (AGENTS.md section 1).
 */
export default function Page() {
  return null;
}
