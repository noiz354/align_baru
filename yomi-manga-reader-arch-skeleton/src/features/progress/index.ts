/**
 * features/progress — public surface (rule D9).
 *
 * Depends on: nothing (defines its own ports — DAG root used by reader,
 * catalog, library). Used by: reader (write path), catalog (resume),
 * library (status), web (progress/history APIs).
 *
 * Server-side only modules (progress writes touch storage): the web layer
 * wires the services via composition; client components never import this
 * feature's server modules (rule D7) — client progress uses the
 * device-local store (T-READER-024) + the progress API.
 */
export * from './reader-progress.repository';
export * from './history.repository';
