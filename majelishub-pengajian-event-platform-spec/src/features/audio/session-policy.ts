/**
 * Recording policy resolution and the acknowledgement gate.
 *
 * Where this belongs: features/audio.
 * Specification: AUDIO.md §2, CONTENT.md §policies, TASKS.md T-AUDIO-002, PRIVACY.md §5.
 * Invariants: the policy is snapshotted at session start and governs that session even if the event's
 *   policy later changes; a session cannot start without a recorded acknowledgement (actor + time);
 *   INTERNAL sessions never render a public player; changing a policy after capture is audited and
 *   cannot retroactively widen what has already been published.
 * Privacy: implements the transparency duty for audio capture; the announcement text is plain and
 *   printable.
 * Failure cases: policy changed mid-event · speaker objects afterwards (withdrawal path) ·
 *   acknowledgement lost to a refresh (re-required, never assumed) · event cancelled after recording.
 * Task ownership: T-AUDIO-002.
 */
import type { RecordingPolicy } from "@/shared/contracts/audio";

export interface PolicyStatement {
  readonly policy: RecordingPolicy;
  readonly capturedText: string;      // plain Indonesian, shown before starting
  readonly announcementText: string;  // for the room, printable
  readonly snapshotAt: string;
}

/** @throws Error("Not implemented: T-AUDIO-002") */
export async function resolveSessionPolicy(input: { eventId: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<PolicyStatement> {
  throw new Error("Not implemented: T-AUDIO-002");
}

/** @throws Error("Not implemented: T-AUDIO-002") */
export async function acknowledgePolicy(input: { sessionId: string; policy: RecordingPolicy; actor: import("@/shared/contracts/permissions").Actor }): Promise<void> {
  throw new Error("Not implemented: T-AUDIO-002");
}
