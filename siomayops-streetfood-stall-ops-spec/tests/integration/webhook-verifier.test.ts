import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyProviderCallback } from "../../src/server/payments/webhook-verifier";

const secret = "test-secret-do-not-use-in-production";
const valid = { partnerReferenceNo: "sale-1", providerReferenceId: "qris-1", amountMinor: 15000, currency: "IDR", state: "PAID" };
function callback(body: unknown, signature?: string) {
  const rawBody = JSON.stringify(body);
  return verifyProviderCallback({
    providerId: "test-provider", rawBody,
    headers: { "x-signature": signature ?? createHmac("sha256", secret).update(rawBody).digest("hex") },
  });
}

afterEach(() => { delete process.env.PAYMENT_WEBHOOK_SECRET; });
describe("T-PAY-001 callback authenticity boundary", () => {
  it("fails closed without a configured secret, including fake signatures", () => {
    expect(callback(valid).kind).toBe("REJECTED");
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    expect(callback(valid, "fake-signature")).toEqual({ kind: "REJECTED", reasonCode: "SIGNATURE_INVALID" });
  });
  it("accepts an authentic callback with exact amount, currency and state", () => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    expect(callback(valid)).toMatchObject({ kind: "VERIFIED", callback: { amountMinor: 15000, currency: "IDR", state: "PAID" } });
  });
  it.each([
    [{ ...valid, amountMinor: "15000" }, "AMOUNT_MISMATCH"],
    [{ ...valid, amountMinor: 0 }, "AMOUNT_MISMATCH"],
    [{ ...valid, currency: "USD" }, "AMOUNT_MISMATCH"],
    [{ ...valid, state: "PENDING" }, "MALFORMED"],
    [{ ...valid, providerReferenceId: "" }, "REFERENCE_UNKNOWN"],
  ])("rejects invalid signed payload %j", (body, reason) => {
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    expect(callback(body)).toEqual({ kind: "REJECTED", reasonCode: reason });
  });
});
