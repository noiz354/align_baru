import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface VerifiedCallback {
  readonly providerId: string;
  readonly partnerReferenceNo: string;
  readonly providerReferenceId: string;
  readonly state: "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";
  readonly amountMinor: number;
  readonly currency: "IDR";
  readonly providerOccurredAt: Date;
  readonly callbackFingerprint: string;
}

export type CallbackVerification =
  | { readonly kind: "VERIFIED"; readonly callback: VerifiedCallback }
  | { readonly kind: "REJECTED"; readonly reasonCode: "SIGNATURE_INVALID" | "REFERENCE_UNKNOWN" | "AMOUNT_MISMATCH" | "REPLAY_DETECTED" | "MALFORMED" };

/** Provider-independent HMAC boundary. A merchant-specific adapter must validate
 * its exact signed bytes and reference mapping before this can serve real QRIS.
 * T-PAY-001 / FR-PAYMENT-014 / ADR-0011; never treat browser input as a webhook.
 */
export function verifyProviderCallback(input: {
  providerId: string;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
}): CallbackVerification {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const signature = input.headers["x-signature"] ?? input.headers["X-Signature"] ?? "";
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { kind: "REJECTED", reasonCode: "SIGNATURE_INVALID" };
  }
  const expected = createHmac("sha256", secret).update(input.rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
    return { kind: "REJECTED", reasonCode: "SIGNATURE_INVALID" };
  }
  let body: unknown;
  try { body = JSON.parse(input.rawBody); } catch {
    return { kind: "REJECTED", reasonCode: "MALFORMED" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { kind: "REJECTED", reasonCode: "MALFORMED" };
  }
  const payload = body as Record<string, unknown>;
  const partnerRef = payload.partnerReferenceNo;
  const providerRef = payload.providerReferenceId;
  if (typeof partnerRef !== "string" || !partnerRef.trim() ||
      typeof providerRef !== "string" || !providerRef.trim()) {
    return { kind: "REJECTED", reasonCode: "REFERENCE_UNKNOWN" };
  }
  if (typeof payload.amountMinor !== "number" || !Number.isSafeInteger(payload.amountMinor) || payload.amountMinor <= 0 || payload.currency !== "IDR") {
    return { kind: "REJECTED", reasonCode: "AMOUNT_MISMATCH" };
  }
  const states = ["PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED"] as const;
  if (!states.some(s => s === payload.state)) {
    return { kind: "REJECTED", reasonCode: "MALFORMED" };
  }
  return {
    kind: "VERIFIED",
    callback: {
      providerId: input.providerId,
      partnerReferenceNo: partnerRef,
      providerReferenceId: providerRef,
      state: payload.state as VerifiedCallback["state"],
      amountMinor: payload.amountMinor,
      currency: "IDR",
      providerOccurredAt: new Date(),
      callbackFingerprint: createHash("sha256").update(input.rawBody).digest("hex").slice(0, 16),
    },
  };
}
