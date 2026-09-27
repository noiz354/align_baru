/**
 * features/catalog — public surface (rule D9).
 * Depends on: manga, chapters, progress (ports). Used by: web layer.
 *
 * Tasks: T-CATALOG-002 (list/facets), T-CATALOG-007 (chapter list).
 */
export * from './catalog.service';
export * from './catalog.repository';
export * from './catalog-cursor';
export * from './catalog-vocabulary';
