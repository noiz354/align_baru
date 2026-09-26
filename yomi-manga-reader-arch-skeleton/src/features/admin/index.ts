/**
 * features/admin — public surface (rule D9).
 * Depends on: manga, chapters, uploads, auth (guards) — per
 * dependency-rules.md §2 (the allowed-edges table). Used by: web layer.
 */
export * from './admin.service';
