/**
 * Normalisation and derivative generation (loudness target, 16 kHz ASR input, waveform peaks).
 *
 * Where this belongs: server/processing.
 * Specification: docs/media/AUDIO-QUALITY.md §1/§4, ADR-0009.
 * Invariants: processing reads ONLY the master (never partial chunks), so it is reproducible; loudness
 *   target -16 LUFS with true peak <= -1.5 dBTP; the 16 kHz derivative is regenerable at any time; the
 *   configuration version is recorded so a later re-process is explainable; no ML "enhancement" (it
 *   would alter what a quotation sounds like).
 * Task ownership: T-AUDIO-010.
 */
export interface ProcessingResult {
  readonly normalizedMasterKey: string;
  readonly asrDerivativeKey: string;
  readonly peaksKey: string;
  readonly measuredLufs: number;
  readonly truePeakDb: number;
  readonly configVersion: string;
}

/** @throws Error("Not implemented: T-AUDIO-010") */
export async function processMaster(input: { sessionId: string; masterKey: string }): Promise<ProcessingResult> {
  throw new Error("Not implemented: T-AUDIO-010");
}
