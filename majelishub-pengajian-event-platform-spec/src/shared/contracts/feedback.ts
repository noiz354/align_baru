/**
 * Feedback contracts.
 * Specification: FEEDBACK.md, ADR-0016 (anonymity CHECK + small-sample suppression), NFR-ETH-001.
 * Invariants:
 *   1. Dimensions: registration, venue, audio, topicRelevance, organization, overall (required).
 *      There is deliberately NO speaker-quality dimension (no evaluation of people).
 *   2. Anonymous rows have `registration_id IS NULL AND contact_hash IS NULL` (database CHECK).
 *   3. Aggregates are shown only when n >= 5; nothing is public, ever.
 *   4. One request per person; raw feedback becomes aggregates after 12 months (RETENTION.md).
 */
export interface FeedbackSubmission {
  readonly eventId: string;
  readonly anonymous: boolean;
  readonly registrationToken?: string; // absent for anonymous submissions
  readonly ratings: {
    readonly registration: number;
    readonly venue: number;
    readonly audio: number;
    readonly topicRelevance: number;
    readonly organization: number;
    readonly overall: number;
  };
  readonly comment?: string;
}

export interface FeedbackAggregate {
  readonly eventId: string;
  readonly responseCount: number;
  readonly denominator: number;        // e.g. 18 of 300 registered - always reported together
  readonly suppressed: boolean;        // true when responseCount < 5
  readonly dimensions?: Readonly<Record<string, number>>;
  readonly asOf: string;
}
