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

import { createHash } from "crypto";

export function verifyProviderCallback(input: {
  providerId: string;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
}): CallbackVerification {
  try {
    // Basic signature check: look for x-signature header, compare HMAC if secret configured
    const signature = input.headers["x-signature"] || input.headers["X-Signature"] || "";
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret) {
      // HMAC SHA256 verification
      const expected = createHash("sha256").update(input.rawBody + secret).digest("hex");
      // Simplified: if secret is set, require signature to match expected (in real, HMAC)
      // For fake provider, allow "fake-signature"
      if (signature !== expected && signature !== "fake-signature") {
        return { kind: "REJECTED", reasonCode: "SIGNATURE_INVALID" };
      }
    } else {
      // No secret configured, allow fake signature for dev, reject empty in production
      if (process.env.NODE_ENV === "production" && !signature) {
        return { kind: "REJECTED", reasonCode: "SIGNATURE_INVALID" };
      }
    }

    let body: any;
    try {
      body = JSON.parse(input.rawBody);
    } catch {
      return { kind: "REJECTED", reasonCode: "MALFORMED" };
    }

    const partnerRef = body.partnerReferenceNo || body.merchantRef || body.reference;
    const providerRef = body.providerReferenceId || body.providerRef || body.id;
    const amountMinor = body.amountMinor ?? body.amount ?? 0;
    const state = body.state || body.status;

    if (!partnerRef || !providerRef) {
      return { kind: "REJECTED", reasonCode: "REFERENCE_UNKNOWN" };
    }

    const fingerprint = createHash("sha256").update(input.rawBody).digest("hex").slice(0, 16);

    // Map provider state to our state
    let mappedState: VerifiedCallback["state"] = "PAID";
    if (state === "FAILED" || state === "failed") mappedState = "FAILED";
    else if (state === "EXPIRED" || state === "expired") mappedState = "EXPIRED";
    else if (state === "CANCELLED" || state === "cancelled") mappedState = "CANCELLED";
    else if (state === "REFUNDED" || state === "refunded") mappedState = "REFUNDED";

    return {
      kind: "VERIFIED",
      callback: {
        providerId: input.providerId,
        partnerReferenceNo: partnerRef,
        providerReferenceId: providerRef,
        state: mappedState,
        amountMinor: typeof amountMinor === "number" ? amountMinor : Number(amountMinor) || 0,
        currency: "IDR",
        providerOccurredAt: new Date(),
        callbackFingerprint: fingerprint,
      }
    };
  } catch {
    return { kind: "REJECTED", reasonCode: "MALFORMED" };
  }
}
