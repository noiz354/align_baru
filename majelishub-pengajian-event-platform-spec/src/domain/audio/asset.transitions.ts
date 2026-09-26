/**
 * AudioAsset machine (PENDING -> UPLOADED -> ASSEMBLING -> ASSEMBLED -> PROCESSING -> READY ...).
 *
 * Where this belongs: `src/domain/audio/`.
 * Specification: STATE_MACHINE.md §5, docs/media/AUDIO-PIPELINE.md §2, ADR-0009 (a new master version
 *   supersedes, never overwrites; the old master is retained).
 * Invariants: exactly one `is_current` asset per session (partial unique index - C11); SUPERSEDED and
 *   DELETED are terminal; a DELETED asset's object keys must already be unreachable.
 * Task ownership: T-AUDIO-009/010/011.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type AssetState = "PENDING" | "UPLOADED" | "ASSEMBLING" | "ASSEMBLED" | "PROCESSING" | "READY" | "SUPERSEDED" | "DELETED" | "FAILED";
export type AssetTrigger = "CREATE" | "ASSEMBLE" | "PROCESS" | "SUPERSEDE" | "SOFT_DELETE" | "FAIL";

export const audioAssetTransitions: TransitionTable<AssetState, AssetTrigger> = {
  machine: "AudioAsset",
  states: ["PENDING","UPLOADED","ASSEMBLING","ASSEMBLED","PROCESSING","READY","SUPERSEDED","DELETED","FAILED"],
  terminalStates: ["SUPERSEDED", "DELETED"],
  transitions: [
    { from: [], to: "PENDING", trigger: "CREATE", guardId: "G-AUDIO-SESSION-ASSEMBLY-ELIGIBLE", sideEffectIds: [] },
    { from: ["PENDING"], to: "ASSEMBLING", trigger: "ASSEMBLE", guardId: "G-AUDIO-CHUNK-SET-CONSISTENT", sideEffectIds: ["job-enqueue"] },
    { from: ["ASSEMBLED"], to: "PROCESSING", trigger: "PROCESS", guardId: "G-AUDIO-MASTER-OBJECT-EXISTS", sideEffectIds: ["job-enqueue"] },
    { from: ["PROCESSING"], to: "READY", trigger: "PROCESS", guardId: "G-AUDIO-NORMALISED-AND-DERIVED", sideEffectIds: ["asset-ready"] },
    { from: ["READY"], to: "SUPERSEDED", trigger: "SUPERSEDE", guardId: "G-AUDIO-NEWER-VERSION-IS-CURRENT", sideEffectIds: ["audit"] },
    { from: ["READY","FAILED","SUPERSEDED"], to: "DELETED", trigger: "SOFT_DELETE", guardId: "G-AUDIO-RETENTION-OR-WITHDRAWAL", sideEffectIds: ["audit","deletion-evidence"] },
    { from: ["ASSEMBLING","PROCESSING"], to: "FAILED", trigger: "FAIL", guardId: "G-AUDIO-RETRIES-EXHAUSTED", sideEffectIds: ["alert"] },
  ],
};
