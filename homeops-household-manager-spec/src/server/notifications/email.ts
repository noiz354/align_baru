// HomeOps - server skeleton (specification phase). Adapter contract only.

/**
 * Email adapter, used for invitations and password recovery only in v1 (ADR-019, proposed).
 * When no provider is configured the flows degrade to shareable links rather than failing
 * (PRD assumption A-4). No household content beyond the invitation link is ever emailed.
 *
 * Status: unimplemented by design. Owning task: T-NOTIF-009.
 */
export type EmailDeliveryResult = {
  readonly outcome: 'delivered' | 'transient_failure' | 'permanent_failure';
  readonly errorClass?: string;
};

export async function sendEmail(_input: {
  readonly to: string;
  readonly template: 'INVITATION' | 'PASSWORD_RESET';
  readonly variables: Readonly<Record<string, string>>;
}): Promise<EmailDeliveryResult> {
  throw new Error('Not implemented: T-NOTIF-009');
}
