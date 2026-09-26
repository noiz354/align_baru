/**
 * NotificationIntent machine (PENDING -> DISPATCHED / FAILED -> DEAD_LETTERED, CANCELLED).
 *
 * Where this belongs: `src/domain/notifications/`.
 * Specification: STATE_MACHINE.md §8, NOTIFICATIONS.md (classes, dedupe, quiet hours, channel rules).
 * Invariants: exactly one delivery per `dedupe_key` (C10); DEAD_LETTERED and CANCELLED are terminal;
 *   a cancellation reason is recorded; replay after dead-lettering is a deliberate, audited action and
 *   must be relevance-checked (a stale reminder is not sent).
 * Task ownership: T-NOTIF-001/006/008.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type IntentState = "PENDING" | "DISPATCHED" | "FAILED" | "DEAD_LETTERED" | "CANCELLED";
export type IntentTrigger = "DISPATCH_OK" | "DISPATCH_FAIL" | "EXHAUST_RETRIES" | "CANCEL" | "REPLAY";

export const notificationIntentTransitions: TransitionTable<IntentState, IntentTrigger> = {
  machine: "NotificationIntent",
  states: ["PENDING", "DISPATCHED", "FAILED", "DEAD_LETTERED", "CANCELLED"],
  terminalStates: ["DISPATCHED", "DEAD_LETTERED", "CANCELLED"],
  transitions: [
    { from: ["PENDING"], to: "DISPATCHED", trigger: "DISPATCH_OK", guardId: "G-NOTIF-CHANNEL-ALLOWED-AND-NOT-QUIET-HOURS", sideEffectIds: ["delivery-record"] },
    { from: ["PENDING"], to: "FAILED", trigger: "DISPATCH_FAIL", guardId: "G-NOTIF-RETRYABLE", sideEffectIds: ["retry-schedule"] },
    { from: ["FAILED"], to: "DEAD_LETTERED", trigger: "EXHAUST_RETRIES", guardId: "G-NOTIF-ATTEMPT-LIMIT", sideEffectIds: ["alert"] },
    { from: ["PENDING","FAILED"], to: "CANCELLED", trigger: "CANCEL", guardId: "G-NOTIF-CANCEL-REASON", sideEffectIds: ["audit"] },
    { from: ["DEAD_LETTERED"], to: "PENDING", trigger: "REPLAY", guardId: "G-NOTIF-RELEVANCE-CHECKED", sideEffectIds: ["audit","new-intent-row"] },
  ],
};
