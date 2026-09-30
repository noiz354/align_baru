import { describe, expect, it } from "vitest";
import { INCIDENT_CATEGORIES, validateIncidentOccurredAt } from "@/domain/incident";
import { incidentSubmitRequestSchema } from "@/shared/contracts/incidents";

const now = new Date("2026-09-30T03:00:00.000Z");

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    categoryCode: "UNOFFICIAL_PAYMENT_REPORTED",
    description: "Operator melaporkan permintaan pembayaran di lokasi.",
    occurredAt: "2026-09-30T02:30:00.000Z",
    clientIncidentId: "70000000-0000-7000-8000-000000000031",
    ...overrides,
  };
}

describe("operator incident report contract and neutral category catalog", () => {
  it("includes explicit neutral categories for reported unofficial-payment and security events", () => {
    expect(INCIDENT_CATEGORIES.map(({ code }) => code)).toContain("UNOFFICIAL_PAYMENT_REPORTED");
    expect(INCIDENT_CATEGORIES.map(({ code }) => code)).toContain("SECURITY_CONCERN_REPORTED");
    expect(INCIDENT_CATEGORIES.find(({ code }) => code === "UNOFFICIAL_PAYMENT_REPORTED")?.help).toContain("bukan penetapan");
  });

  it("accepts a structured report with optional integer IDR amount and operator urgency hint", () => {
    const parsed = incidentSubmitRequestSchema.safeParse(validInput({ severityHint: "P1", amountMinor: 50000, amountContext: "REQUESTED" }));
    expect(parsed.success).toBe(true);
  });

  it("requires the amount and its requested/paid context together, and rejects floats or oversized values", () => {
    expect(incidentSubmitRequestSchema.safeParse(validInput({ amountMinor: 50000 })).success).toBe(false);
    expect(incidentSubmitRequestSchema.safeParse(validInput({ amountMinor: 50000.5, amountContext: "PAID" })).success).toBe(false);
    expect(incidentSubmitRequestSchema.safeParse(validInput({ amountMinor: 1_000_000_001, amountContext: "PAID" })).success).toBe(false);
  });

  it("rejects unknown/client-selected protected scope fields and bounds the narrative", () => {
    expect(incidentSubmitRequestSchema.safeParse(validInput({ operatorId: "30000000-0000-7000-0000-000000000001" })).success).toBe(false);
    expect(incidentSubmitRequestSchema.safeParse(validInput({ evidenceAssetIds: ["asset-1"] })).success).toBe(false);
    expect(incidentSubmitRequestSchema.safeParse(validInput({ description: "short" })).success).toBe(false);
    expect(incidentSubmitRequestSchema.safeParse(validInput({ description: "x".repeat(2001) })).success).toBe(false);
  });

  it("allows chronology in the past but rejects invalid or future event times", () => {
    expect(validateIncidentOccurredAt(new Date("2026-09-29T23:00:00.000Z"), now)).toBe(true);
    expect(validateIncidentOccurredAt(new Date("2026-09-30T03:06:00.000Z"), now)).toBe(false);
    expect(validateIncidentOccurredAt(new Date("invalid"), now)).toBe(false);
  });
});
