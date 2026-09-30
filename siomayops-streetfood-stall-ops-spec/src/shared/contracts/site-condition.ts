import { z } from "zod";
import { uuidSchema } from "./common";

export const siteConditionObservationRequestSchema = z.object({
  clientRequestId: uuidSchema,
  groundCondition: z.enum(["DRY", "WET"]),
  shelterStatus: z.enum(["AVAILABLE", "NOT_AVAILABLE", "UNKNOWN"]),
  shelterNote: z.string().trim().max(240).optional(),
  relocationDecisionNote: z.string().trim().max(300).optional(),
}).strict();

export type SiteConditionObservationRequest = z.infer<typeof siteConditionObservationRequestSchema>;
