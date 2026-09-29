/**
 * ReaderPreferenceRepository port — the orphaned table's owner.
 *
 * The `reader_preference` table existed with no port, no repository, no
 * service, no route and no reader: a full vertical slice of nothing. This port
 * is the top of the slice that ends that.
 *
 * Semantics:
 * - One row per user, keyed by `user_id`. No row yet is NOT an error — it is a
 *   reader who never opened settings, and the answer is the documented
 *   defaults (which match the column defaults, so the database and this port
 *   cannot disagree about what "unset" means).
 * - `get` never creates. A read that wrote would turn every anonymous-adjacent
 *   lookup into a write, and the row appears on first PUT instead — creation
 *   is a side effect of choosing, not of looking.
 * - `put` is a partial upsert: named fields replace, unnamed fields stay. A
 *   full-replace PUT would force every client to read before writing and race
 *   with itself across tabs.
 *
 * Requirements: FR-READER-xxx (preferences), DATA_MODEL (reader_preference).
 * Tasks: T-READER-0xx (F-013-S1/S2).
 */
import type { UserId } from '../../shared/types';
import type { ReaderPreference } from '../../shared/contracts/reader';

export interface PreferencePatch {
  defaultMode?: ReaderPreference['defaultMode'];
  directionOverride?: ReaderPreference['directionOverride'];
  zoomDefault?: number;
  autoNextChapter?: boolean;
}

export interface ReaderPreferenceRepository {
  /**
   * The caller's preferences, or the documented defaults when no row exists.
   * Never throws for a missing row; never creates one.
   */
  get(userId: UserId): Promise<ReaderPreference>;
  /**
   * Store the named fields, creating the row when absent. Values are assumed
   * validated — the SERVICE owns the CHECK mirrors, because a repository that
   * validates and a service that validates are two sources of truth for one
   * rule, and the database CHECKs are the last line, not the first.
   */
  put(userId: UserId, patch: PreferencePatch): Promise<ReaderPreference>;
}
