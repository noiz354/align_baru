/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
export * from "./provider";
export * from "./webhook-verifier";
/**
 * Adapters live in ./adapters. NONE EXIST YET and none may be added before VS-6/VS-17
 * (T-PAY-001, ADR-0011, ADR-0012). Payment behaviour must never be simulated.
 */
