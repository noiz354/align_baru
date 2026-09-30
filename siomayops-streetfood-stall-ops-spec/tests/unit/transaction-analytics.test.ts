import { describe, expect, it, vi } from "vitest";
import { logger } from "@/server/telemetry/logger";
import { trackTransactionEvent } from "@/features/sales/transaction-analytics";

describe("transaction analytics", () => {
  it("emits a structured, privacy-minimal event through the existing logger", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    trackTransactionEvent("transaction_created", { requestId: "request-safe-id", status: "PAID" });
    expect(spy).toHaveBeenCalledWith("product_analytics", expect.objectContaining({
      eventName: "transaction_created", page: "transactions", requestId: "request-safe-id", status: "PAID",
    }));
    const serializedProperties = JSON.stringify(spy.mock.calls[0]?.[1]);
    expect(serializedProperties).not.toContain("amount");
    expect(serializedProperties).not.toContain("customer");
    spy.mockRestore();
  });
});
