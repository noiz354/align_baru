/**
 * features/reader — public surface (rule D9).
 *
 * Client-safe modules (importable by client components — rule D7):
 *   reader-state (reducer), reader-window (window), page-index (validation),
 *   and (later) pairing + mode/direction transition tables.
 * Server-side modules: progress persistence is owned by features/progress
 * (reader depends on its ports — it does not own them).
 *
 * Depends on: chapters, progress (ports), shared. Used by: web (reader page).
 */
export * from './reader-state';
export * from './reader-window';
export * from './page-index';
