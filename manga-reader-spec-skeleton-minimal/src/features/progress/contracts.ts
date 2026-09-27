/**
 * Persistence port only. Feature code depends on this contract, never a DB driver.
 * Requirements: FR-READER-014, FR-LIBRARY-006, NFR-DATA-003.
 * ADR-003/006/007. Tasks: T-READER-021. See DATA_MODEL.md and API_CONTRACT.md.
 */
export interface ReaderProgress {
  chapterId: string;
  pageNumber: number;
  updatedAt: string;
  version: string;
}

export interface SaveReaderProgressInput {
  userId: string;
  chapterId: string;
  pageNumber: number;
  expectedVersion?: string;
}

export interface ReaderProgressRepository {
  saveProgress(input: SaveReaderProgressInput): Promise<ReaderProgress>;
  getProgress(userId: string, chapterId: string): Promise<ReaderProgress | null>;
}

/**
 * In-memory fallback / repository implementation for reader progress.
 */
export class InMemoryReaderProgressRepository implements ReaderProgressRepository {
  private store = new Map<string, ReaderProgress>();

  async saveProgress(input: SaveReaderProgressInput): Promise<ReaderProgress> {
    const key = `${input.userId}:${input.chapterId}`;
    const existing = this.store.get(key);
    const version = existing ? String(Number(existing.version) + 1) : "1";
    const record: ReaderProgress = {
      chapterId: input.chapterId,
      pageNumber: input.pageNumber,
      updatedAt: new Date().toISOString(),
      version,
    };
    this.store.set(key, record);
    return record;
  }

  async getProgress(userId: string, chapterId: string): Promise<ReaderProgress | null> {
    const key = `${userId}:${chapterId}`;
    return this.store.get(key) ?? null;
  }
}
