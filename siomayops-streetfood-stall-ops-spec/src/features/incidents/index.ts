/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Incidents are recorded neutrally: describing an incident is not an accusation and never feeds
 * an automatic judgement about a person (FR-INC-006).
 */
import type { IncidentId, ShiftId, StallId, SellingLocationId } from "../../shared/types/ids";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus =
  | "REPORTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

/** Requirements: FR-INC-001..005/010. Task: T-INC-001. Offline-OK. */
export async function submitIncident(_input: {
  shiftId?: ShiftId; stallId?: StallId; sellingLocationId?: SellingLocationId; categoryId: string;
  severity: IncidentSeverity; description: string; peopleInvolvedNote?: string;
  evidenceAssetIds?: readonly string[]; clientIncidentId: string; recordedAtDevice?: Date;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus }> {
  throw new Error("Not implemented: T-INC-001");
}

/** Requirements: FR-INC-005/006/008. Task: T-INC-002. Escalation is human; safety path is direct. */
export async function transitionIncident(_input: {
  incidentId: IncidentId; to: IncidentStatus; reason?: string; resolutionNote?: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus }> {
  throw new Error("Not implemented: T-INC-002");
}
