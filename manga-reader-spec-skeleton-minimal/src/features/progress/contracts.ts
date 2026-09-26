/**
 * Persistence port only. Feature code depends on this contract, never a DB driver.
 * Requirements: FR-READER-014, FR-LIBRARY-006, NFR-DATA-003.
 * ADR-003/006/007. Tasks: T-READER-021. See DATA_MODEL.md and API_CONTRACT.md.
 */
export interface ReaderProgress { chapterId: string; pageNumber: number; updatedAt: string; version: string; }
export interface SaveReaderProgressInput { userId: string; chapterId: string; pageNumber: number; expectedVersion?: string; }
export interface ReaderProgressRepository {
  /** TODO(T-READER-021): define concurrency/idempotency after data model review. */
  saveProgress(input: SaveReaderProgressInput): Promise<ReaderProgress>;
  /** TODO(T-READER-021): enforce ownership at application boundary. */
  getProgress(userId: string, chapterId: string): Promise<ReaderProgress | null>;
}
