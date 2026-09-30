import { z } from "zod";
import { instantSchema, uuidSchema } from "./common";
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITY_HINTS } from "@/domain/incident";

const categoryCodes = INCIDENT_CATEGORIES.map(({ code }) => code) as [typeof INCIDENT_CATEGORIES[number]["code"], ...typeof INCIDENT_CATEGORIES[number]["code"][]];
const severityHintCodes = INCIDENT_SEVERITY_HINTS.map(({ code }) => code) as ["P1", "P2", "P3"];

export const incidentSubmitRequestSchema = z.object({
  categoryCode: z.enum(categoryCodes),
  severityHint: z.enum(severityHintCodes).optional(),
  description: z.string().trim().min(10).max(2000),
  occurredAt: instantSchema,
  amountMinor: z.number().int().min(1).max(1_000_000_000).optional(),
  amountContext: z.enum(["REQUESTED", "PAID", "UNCLEAR"]).optional(),
  clientIncidentId: uuidSchema,
}).strict().superRefine((value, context) => {
  if ((value.amountMinor === undefined) !== (value.amountContext === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["amountContext"], message: "Amount and amount context must be supplied together" });
  }
});
export type IncidentSubmitRequest = z.infer<typeof incidentSubmitRequestSchema>;
