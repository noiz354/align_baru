/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Operational messaging ONLY, anchored to records — never a general chat product (FR-COMM-001/006).
 * No money state may depend on a message being delivered or read (FR-COMM-004).
 */
import type { ShiftId } from "../../shared/types/ids";

export type OperationalRequestKind =
  | "NEED_HELP" | "CANNOT_SELL" | "EQUIPMENT_BROKEN" | "STOCK_OUT" | "CASH_ISSUE" | "OTHER";

export interface OperationalRequest {
  readonly requestId: string;
  readonly shiftId: ShiftId;
  readonly kind: OperationalRequestKind;
  readonly note?: string;
  readonly createdAt: Date;
  readonly acknowledgedAt?: Date;
}

/** Requirements: FR-COMM-002/003/005/008. Task: T-COMM-001. Two taps; quiet hours respected. */
export async function raiseOperationalRequest(_input: {
  shiftId: ShiftId; kind: OperationalRequestKind; note?: string; clientRequestId: string;
}): Promise<OperationalRequest> {
  throw new Error("Not implemented: T-COMM-001");
}

/** Requirements: FR-COMM-003/005/007. Task: T-COMM-001. Replies stay attached to the record thread. */
export async function replyToRequest(_input: {
  requestId: string; body: string;
}): Promise<{ readonly messageId: string }> {
  throw new Error("Not implemented: T-COMM-001");
}
