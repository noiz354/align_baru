// HomeOps - domain skeleton (specification phase). Pure rules only.

import type { ResourceMode } from '../../shared/types';
import type { Level, Resource, ThresholdCrossing, Thresholds } from './types';

/**
 * Default thresholds per mode (FR-RES-005, ADR-011):
 *   EXACT               lowAt = max(25% of target, 3), criticalAt = 1
 *   APPROXIMATE         no numeric thresholds - the bands are the thresholds
 *   AVAILABLE_UNAVAILABLE  no thresholds - UNAVAILABLE is always CRITICAL
 * Household defaults may override these; per-resource overrides win. The resulting behaviour is
 * always shown to the member in words ("tells us when 3 or fewer left").
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-003 - requirements, ADR, design, and tests are listed there.
 */
export function defaultThresholdsFor(_input: {
  readonly mode: ResourceMode;
  readonly targetQuantity?: number;
}): Thresholds | null {
  throw new Error('Not implemented: T-RES-003');
}

/**
 * Classify a level into a restock band. Pure: no thresholds table lookup beyond the
 * resource it is given, no clock. Binary UNAVAILABLE maps to CRITICAL (I-RES-006).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-005 - requirements, ADR, design, and tests are listed there.
 */
export function classifyLevel(_input: {
  readonly mode: ResourceMode;
  readonly level: Level;
  readonly thresholds?: Thresholds;
}): 'OK' | 'LOW' | 'CRITICAL' {
  throw new Error('Not implemented: T-RES-005');
}

/**
 * Evaluate threshold crossings between the previous and the next level (FR-RES-007).
 * The rule that keeps supplies from nagging: emit an event only on a *transition*, at most once
 * per direction per day (I-RES-005). Ten "used one" taps in a day must never produce ten events,
 * and a household that tops an item up and uses it again the same day is not told twice.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-RES-005 - requirements, ADR, design, and tests are listed there.
 */
export function evaluateResourceThresholds(_input: {
  readonly resource: Resource;
  readonly nextLevel: Level;
  readonly previousCrossingAtInstant: string | null;
  readonly nowInstant: string;
}): readonly ThresholdCrossing[] {
  throw new Error('Not implemented: T-RES-005');
}
