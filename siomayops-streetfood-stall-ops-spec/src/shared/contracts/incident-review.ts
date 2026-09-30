import { z } from "zod";
import { uuidSchema } from "./common";

export const incidentReviewRequestSchema = z.object({
  clientReviewId: uuidSchema,
  status: z.enum(["SUBMITTED", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "ESCALATED", "CLOSED"]).optional(),
  note: z.string().trim().min(10).max(1000).optional(),
}).strict().superRefine((value, context) => {
  if (!value.status && !value.note) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Provide a status change or a follow-up note" });
  }
  if ((value.status === "RESOLVED" || value.status === "CLOSED") && !value.note) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "A factual follow-up note is required for resolution or closure" });
  }
});
export type IncidentReviewRequest = z.infer<typeof incidentReviewRequestSchema>;
