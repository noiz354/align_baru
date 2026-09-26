/**
 * Registration: create, waitlist, promote, cancel - the whole participant transaction.
 *
 * Where this belongs: features/registration.
 * Specification: REGISTRATION.md, STATE_MACHINE.md §2, TASKS.md T-REG-001…T-REG-010/012.
 * Invariants: capacity is never exceeded (C1); one active registration per (event, contact);
 *   cancellation is terminal (a new registration is a new row); a promoted waitlisted participant keeps
 *   the same registration id and token; an idempotent replay returns the original result.
 * Security: public endpoint with durable rate limits (T-REG-009); no enumeration oracle for whether a
 *   contact is already registered beyond the participant's own result.
 * Privacy: minimum fields only; contact stored in the narrow table + keyed hash (T-REG-011).
 * Concurrency: C1 (capacity), C3 (cancel vs check-in).
 * Failure cases: registration closed · full without waitlist · invitation required · duplicate ·
 *   store unavailable (explicit failure, no half-registration).
 * Task ownership: T-REG-001…T-REG-012.
 */
import type { RegistrationRequest, RegistrationResult } from "@/shared/contracts/registration";

/** @throws Error("Not implemented: T-REG-001") */
export async function register(scope: import("@/shared/contracts/scope").TenantScope, request: RegistrationRequest): Promise<RegistrationResult> {
  throw new Error("Not implemented: T-REG-001");
}

/** @throws Error("Not implemented: T-REG-006") */
export async function cancelRegistration(input: { registrationId: string; reason: string; actorKind: "PARTICIPANT" | "ORGANIZER" }): Promise<{ cancelled: boolean }> {
  throw new Error("Not implemented: T-REG-006");
}
