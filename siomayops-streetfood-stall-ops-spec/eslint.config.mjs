/**
 * PHASE 0 shell — module boundary rules (ADR-0035) are declared here as documentation and are
 * enforced in VS-0 (T-FOUND-001) with import-restriction rules. No plugin is installed yet.
 *
 * Rules that must exist:
 *  1. src/domain/** may not import from src/features, src/server, src/app, or any framework package.
 *  2. src/features/** may not import another feature's internals (only its public index).
 *  3. src/app/** may not contain business logic (no direct db/payment access).
 *  4. src/server/** may not be imported from client components ("use client" files).
 *  5. No `any` at boundaries; no floating-point literals in money paths.
 *  6. Files under src/** must not call `new Date()` directly (inject Clock).
 */
export default [
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "dist/**"]
  }
];
