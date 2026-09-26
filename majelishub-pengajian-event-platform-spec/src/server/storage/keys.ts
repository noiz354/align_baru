/**
 * Object key construction - deterministic, id-based, tenant-scoped.
 *
 * Where this belongs: server/storage.
 * Specification: docs/media/STORAGE.md §1, docs/media/CHUNK-PROTOCOL.md §2.
 * Invariants: keys contain only ids, sequence numbers and fixed suffixes; a client-supplied filename
 *   never appears; keys are stable so assembly and retention can compute them; changing the layout
 *   requires an ADR (existing objects must remain addressable).
 * Task ownership: T-AUDIO-014.
 */
export const KEY_LAYOUT = {
  chunk: (org: string, event: string, session: string, sequence: number) => `audio/${org}/${event}/${session}/${sequence}.part`,
  master: (org: string, event: string, session: string) => `audio/${org}/${event}/${session}/master.ogg`,
  asrDerivative: (session: string) => `derived/${session}/asr-16k.flac`,
  peaks: (session: string) => `derived/${session}/peaks.json`,
  export: (org: string, exportId: string) => `exports/${org}/${exportId}.csv`,
} as const;
