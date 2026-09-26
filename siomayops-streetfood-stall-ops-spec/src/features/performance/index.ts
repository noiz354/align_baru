/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 *
 * RECOGNITION FAIRNESS (ADR-0029, PRD §9.4 — binding):
 *  - candidate inputs only; NO scoring algorithm is implemented in this phase;
 *  - revenue alone never decides an outcome (FR-PERF-004);
 *  - inputs are normalised for traffic, shift length, day of week, closures and stock availability
 *    (FR-PERF-005) and gated by a minimum sample size (FR-PERF-003);
 *  - weights and method are published to operators in advance, and a human reviews before any award;
 *  - no automatic penalty can be attached to these values (FR-PERF-009).
 */
import type { OperatorId } from "../../shared/types/ids";
import type { BusinessDay } from "../../shared/time";

export interface PerformanceInputSnapshot {
  readonly operatorId: OperatorId;
  readonly periodKey: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly normalisers: Readonly<Record<string, number>>;
  readonly sampleSize: number;
  readonly computedAt: Date;
}

/** Requirements: FR-PERF-001/002/003. Task: T-PERF-001. */
export async function buildPerformanceSnapshot(_input: {
  operatorId: OperatorId; businessDay: BusinessDay;
}): Promise<PerformanceInputSnapshot> {
  throw new Error("Not implemented: T-PERF-001");
}

/** Requirements: FR-PERF-005/006, FR-RECOG-003. Task: T-PERF-002. */
export async function explainInputsToOperator(_input: {
  operatorId: OperatorId;
}): Promise<{
  readonly inputs: readonly {
    readonly key: string; readonly value: number; readonly explanationMessageId: string;
  }[];
}> {
  throw new Error("Not implemented: T-PERF-002");
}

/** Requirements: FR-RECOG-001/002/004. Task: T-REC-001. Candidate shortlist only — a human decides. */
export async function computeRecognitionPeriod(_input: {
  periodKey: string; organizationId: string;
}): Promise<{
  readonly candidates: readonly { readonly operatorId: OperatorId; readonly sampleSize: number }[];
  readonly reviewRequired: true;
}> {
  throw new Error("Not implemented: T-REC-001");
}

/** Requirements: FR-RECOG-004/005. Task: T-REC-002. Review, rationale and appeal path recorded. */
export async function publishRecognitionAward(_input: {
  periodKey: string; operatorId: OperatorId; reviewerUserId: string; rationaleNote: string;
}): Promise<{ readonly recognitionAwardId: string }> {
  throw new Error("Not implemented: T-REC-002");
}
