// HomeOps - server skeleton (specification phase). Adapter contract only.

/**
 * Web Push adapter (ADR-009, ADR-014). Contract:
 *  - subscriptions are stored per device with the endpoint hashed; 404/410 prunes silently;
 *  - the payload is built by the policy layer, never here (payloads contain ids and type only);
 *  - failures are classified transient vs permanent; no payload or endpoint is ever logged.
 *
 * Status: unimplemented by design. Owning tasks: T-NOTIF-007, T-NOTIF-008.
 */
export type PushDeliveryResult =
  | { readonly outcome: 'delivered' }
  | { readonly outcome: 'transient_failure'; readonly errorClass: string }
  | { readonly outcome: 'permanent_failure'; readonly errorClass: string };

export async function sendPush(_input: {
  readonly endpointHash: string;
  readonly payload: { readonly title: string; readonly body: string; readonly href: string; readonly tag: string };
}): Promise<PushDeliveryResult> {
  throw new Error('Not implemented: T-NOTIF-008');
}
