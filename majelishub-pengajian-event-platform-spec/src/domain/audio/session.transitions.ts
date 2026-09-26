/**
 * RecordingSession machine (IDLE -> RECORDING <-> PAUSED -> STOPPING -> UPLOADED -> assembly states).
 *
 * Where this belongs: `src/domain/audio/` - pure; the client mirrors this machine, the server owns it.
 * Specification: STATE_MACHINE.md §4, docs/media/CHUNK-PROTOCOL.md, ADR-0008 (10 s chunks, IndexedDB
 *   first), ADR-0022 (recorder ports).
 * Invariants: no session without an acknowledged recording-policy statement; stop is final for the
 *   capture (resuming creates a new segment within the same session, not a reopened stop); a gap is
 *   recorded data, not an error; PARTIAL is a truthful terminal state for a session with gaps.
 * Task ownership: T-AUDIO-001/003/005/007/009, T-AUDIO-002 (policy acknowledgement).
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type SessionState =
  | "IDLE" | "RECORDING" | "PAUSED" | "STOPPING" | "UPLOADED" | "ASSEMBLING" | "ASSEMBLED"
  | "PROCESSING" | "READY" | "PARTIAL" | "FAILED" | "ABANDONED";

export type SessionTrigger =
  | "START" | "PAUSE" | "RESUME" | "STOP" | "FLUSH_COMPLETE" | "GAP_DETECTED" | "DEVICE_LOST"
  | "RECOVER_AFTER_RELOAD" | "ASSEMBLY_STARTED" | "ASSEMBLY_OK" | "ASSEMBLY_FAILED"
  | "PROCESSING_OK" | "PROCESSING_FAILED" | "ABANDON";

export const recordingSessionTransitions: TransitionTable<SessionState, SessionTrigger> = {
  machine: "RecordingSession",
  states: ["IDLE","RECORDING","PAUSED","STOPPING","UPLOADED","ASSEMBLING","ASSEMBLED","PROCESSING","READY","PARTIAL","FAILED","ABANDONED"],
  terminalStates: ["READY", "PARTIAL", "FAILED", "ABANDONED"],
  transitions: [
    { from: ["IDLE"], to: "RECORDING", trigger: "START", guardId: "G-AUDIO-POLICY-ACKNOWLEDGED", sideEffectIds: ["RecordingStarted","audit"] },
    { from: ["RECORDING"], to: "PAUSED", trigger: "PAUSE", guardId: "G-AUDIO-OPERATOR-PERMISSION", sideEffectIds: [] },
    { from: ["PAUSED"], to: "RECORDING", trigger: "RESUME", guardId: "G-AUDIO-OPERATOR-PERMISSION", sideEffectIds: [] },
    { from: ["RECORDING","PAUSED"], to: "STOPPING", trigger: "STOP", guardId: "G-AUDIO-SESSION-OWNED-BY-DEVICE", sideEffectIds: ["RecordingStopped"] },
    { from: ["STOPPING"], to: "UPLOADED", trigger: "FLUSH_COMPLETE", guardId: "G-AUDIO-NO-GAPS-OR-GAP-GRACE-PASSED", sideEffectIds: ["AudioUploadCompleted"] },
    { from: ["RECORDING"], to: "RECORDING", trigger: "GAP_DETECTED", guardId: "G-AUDIO-SEQUENCE-GAP", sideEffectIds: ["gap-manifest-append","warn-operator"] },
    { from: ["RECORDING"], to: "RECORDING", trigger: "DEVICE_LOST", guardId: "G-AUDIO-TRACK-ENDED", sideEffectIds: ["warn-operator","gap-manifest-append"] },
    { from: ["RECORDING","PAUSED"], to: "RECORDING", trigger: "RECOVER_AFTER_RELOAD", guardId: "G-AUDIO-LOCAL-QUEUE-PRESENT", sideEffectIds: ["increment-recovery-count","audit"] },
    { from: ["UPLOADED","PARTIAL"], to: "ASSEMBLING", trigger: "ASSEMBLY_STARTED", guardId: "G-AUDIO-SESSION-LOCK-ACQUIRED", sideEffectIds: ["job-enqueue"] },
    { from: ["ASSEMBLING"], to: "ASSEMBLED", trigger: "ASSEMBLY_OK", guardId: "G-AUDIO-OUTPUT-VERIFIED", sideEffectIds: ["AudioAssetCreated"] },
    { from: ["ASSEMBLING"], to: "FAILED", trigger: "ASSEMBLY_FAILED", guardId: "G-AUDIO-RETRIES-EXHAUSTED", sideEffectIds: ["alert"] },
    { from: ["ASSEMBLED"], to: "PROCESSING", trigger: "PROCESSING_STARTED" as SessionTrigger, guardId: "G-AUDIO-PROCESSING-JOB-CLAIMED", sideEffectIds: ["job-enqueue"] },
    { from: ["PROCESSING"], to: "READY", trigger: "PROCESSING_OK", guardId: "G-AUDIO-MASTER-AND-DERIVATIVE-VERIFIED", sideEffectIds: ["asset-ready"] },
    { from: ["IDLE"], to: "ABANDONED", trigger: "ABANDON", guardId: "G-AUDIO-NO-CHUNKS-WITHIN-24H", sideEffectIds: ["notify-organizer"] },
  ],
};
