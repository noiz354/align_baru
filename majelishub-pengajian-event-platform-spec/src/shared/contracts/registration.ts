/**
 * Registration contracts.
 * Specification: REGISTRATION.md, STATE_MACHINE.md §2, API.md (POST /api/v1/events/{eventId}/registrations).
 * Privacy (PRIVACY.md §4): collect the minimum - name, ONE contact method, participant count,
 *   optional accessibility request. No address, no age, no ID number, no gender, ever.
 * Invariants: a registration never becomes a participant profile; cancellation is terminal
 *   (a new registration is a new row); tokens are issued per registration, never per person.
 */
export type RegistrationMode = "OPEN" | "CAPACITY_LIMITED" | "INVITATION" | "WALK_IN" | "NO_REGISTRATION";
export type RegistrationState = "REGISTERED" | "WAITLISTED" | "CANCELLED";

export interface RegistrationRequest {
  readonly eventId: string;
  readonly fullName: string;
  readonly contactKind: "EMAIL" | "PHONE";
  readonly contactValue: string;      // stored in a narrowly-permissioned table + keyed hash for dedupe
  readonly groupSize: number;         // 1..N, defaults to 1
  readonly accessibilityRequest?: string;
  readonly idempotencyKey: string;
}

export interface RegistrationResult {
  readonly registrationId: string;
  readonly state: RegistrationState;
  readonly waitlistPosition?: number;
  /** Capability URL the participant uses to see their code. Never contains a raw DB id. */
  readonly accessToken: string;
  readonly created: boolean;          // false on idempotent replay
}
