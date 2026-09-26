/**
 * Feedback aggregation (pure) with suppression and denominators.
 *
 * Where this belongs: `src/domain/feedback/`.
 * Specification: FEEDBACK.md §5/§6, ADR-0016 (n >= 5), NFR-ETH-001 (no people-ranking output).
 * Invariants:
 *   1. No output may order or compare speakers, mosques or events (no leaderboards, no deltas framed as
 *      competition). If a requested aggregate would create a ranking, the function returns the data
 *      without ordering and the caller must not impose one.
 *   2. Every rate is reported with its denominator ("18 dari 300 terdaftar").
 *   3. Suppression is applied last and is never bypassable by a caller-supplied threshold.
 *   4. Raw feedback becomes aggregates after 12 months; aggregates are recomputable and as-of stamped.
 * Task ownership: T-FEEDBACK-003/006.
 */
import type { FeedbackAggregate } from "@/shared/contracts/feedback";

export interface AggregationInput {
  readonly eventId: string;
  readonly responses: readonly { anonymous: boolean; ratings: Readonly<Record<string, number>> }[];
  readonly registeredCount: number;
  readonly asOf: string;
}

/** @throws Error("Not implemented: T-FEEDBACK-003") */
export function aggregateFeedback(input: AggregationInput): FeedbackAggregate {
  throw new Error("Not implemented: T-FEEDBACK-003");
}
