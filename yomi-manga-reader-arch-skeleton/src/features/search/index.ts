/**
 * features/search — public surface (rule D9).
 * Depends on: nothing (SearchRepository port abstracts the vocab — DAG root).
 * Used by: web layer.
 */
export * from './search.service';
export * from './search.repository';
