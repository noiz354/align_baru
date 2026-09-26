/**
 * features/auth — public surface (the only thing other modules may import:
 * rule D9).
 *
 * Modules: auth.service (rules), password (port+policy), session (port+
 * math), user.repository (port).
 *
 * Dependency note: features/auth depends on NO other feature (DAG root —
 * dependency-rules.md §2). Other features receive the guard helpers from
 * the WEB layer (route guards), not by importing auth's internals.
 */
export * from './auth.service';
export * from './password';
export * from './session';
export * from './user.repository';
