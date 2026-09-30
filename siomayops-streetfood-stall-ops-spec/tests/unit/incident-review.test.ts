import { describe, expect, it } from "vitest";
import { incidentReviewRequestSchema } from "@/shared/contracts/incident-review";

const clientReviewId = "70000000-0000-7000-8000-000000000071";

describe("incident review request contract", () => {
  it("accepts a note-only review and a status transition with a factual note", () => {
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, note: "Supervisor checked the site and recorded next steps." }).success).toBe(true);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, status: "INVESTIGATING", note: "Follow-up assigned to the operations team." }).success).toBe(true);
  });

  it("requires either a note or transition, and requires a note to resolve or close", () => {
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId }).success).toBe(false);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, status: "RESOLVED" }).success).toBe(false);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, status: "CLOSED", note: "   " }).success).toBe(false);
  });

  it("rejects unknown statuses, overlong notes and client-selected scope or evidence fields", () => {
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, status: "OPEN" }).success).toBe(false);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, note: "x".repeat(1001) }).success).toBe(false);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, note: "Review note is factual.", organizationId: "tenant" }).success).toBe(false);
    expect(incidentReviewRequestSchema.safeParse({ clientReviewId, note: "Review note is factual.", evidenceAssetIds: ["asset"] }).success).toBe(false);
  });
});
