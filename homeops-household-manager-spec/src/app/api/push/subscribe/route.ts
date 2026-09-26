// HomeOps - route skeleton (specification phase). Handler shells only.

/**
 * POST   /api/push/subscribe   register or replace this device's subscription
 * DELETE /api/push/subscribe   remove this device (signing out of one device only)
 *
 * Rules: the member id comes from the session, never from the body; the endpoint is stored hashed;
 * keys are validated; 404/410 from the push service prunes the subscription silently; endpoints are
 * never logged (PRIVACY.md section 5, T-NOTIF-007).
 *
 * Owning task: T-NOTIF-007.
 */
export async function POST(_request: Request): Promise<Response> {
  throw new Error('Not implemented: T-NOTIF-007');
}

export async function DELETE(_request: Request): Promise<Response> {
  throw new Error('Not implemented: T-NOTIF-007');
}
