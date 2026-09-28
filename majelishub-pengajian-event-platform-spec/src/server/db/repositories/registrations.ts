import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { eventRegistrations, eventAttendance } from "../schema/registrations";
import type { DbOrTx } from "../client";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    const b = bytes[i]!;
    out += chars[b % chars.length]!;
  }
  return `${out.slice(0,3)}-${out.slice(3,6)}`;
}

export async function createRegistration(
  db: DbOrTx,
  input: { organizationId: string; eventId: string; attendeeEmail: string; attendeeName: string }
): Promise<{ registration: typeof eventRegistrations.$inferSelect; token: string; shortCode: string }> {
  // check duplicate active registration for same event+email → return existing
  const existing = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, input.eventId as any), eq(eventRegistrations.attendeeEmail, input.attendeeEmail)))
    .limit(1);
  if (existing[0]) {
    // Need token to return? But we don't store plain token; for duplicate we generate a new retrieval? For MVP we return existing registration with no token (or re-issue? Spec says CONFLICT returns existing via capability). For Wave3, we return existing with 409 handling in route.
    // Here we throw to let caller handle 409
    throw Object.assign(new Error("DUPLICATE_REGISTRATION"), { code: "DUPLICATE", existing: existing[0] });
  }
  const token = randomBytes(32).toString("hex"); // opaque 64 hex
  const tokenHash = hashToken(token);
  let shortCode = generateShortCode();
  // ensure shortCode unique (retry)
  for (let i = 0; i < 3; i++) {
    const clash = await db.select().from(eventRegistrations).where(eq(eventRegistrations.shortCode, shortCode)).limit(1);
    if (clash.length === 0) break;
    shortCode = generateShortCode();
  }
  const [row] = await db
    .insert(eventRegistrations)
    .values({
      organizationId: input.organizationId as any,
      eventId: input.eventId as any,
      attendeeEmail: input.attendeeEmail,
      attendeeName: input.attendeeName,
      tokenHash,
      shortCode,
    })
    .returning();
  return { registration: row, token, shortCode };
}

export async function findRegistrationByTokenHash(db: DbOrTx, tokenHash: string) {
  const rows = await db.select().from(eventRegistrations).where(eq(eventRegistrations.tokenHash, tokenHash)).limit(1);
  return rows[0] ?? null;
}

export async function findRegistrationByShortCode(db: DbOrTx, shortCode: string) {
  const rows = await db.select().from(eventRegistrations).where(eq(eventRegistrations.shortCode, shortCode)).limit(1);
  return rows[0] ?? null;
}

export async function findRegistrationById(db: DbOrTx, id: string) {
  const rows = await db.select().from(eventRegistrations).where(eq(eventRegistrations.id, id as any)).limit(1);
  return rows[0] ?? null;
}

export function hashTokenForLookup(token: string): string {
  return hashToken(token);
}

export async function createAttendanceIfNotExists(
  db: DbOrTx,
  input: { organizationId: string; eventId: string; registrationId: string; checkedInBy?: string }
): Promise<{ attendance: typeof eventAttendance.$inferSelect; created: boolean }> {
  const existing = await db.select().from(eventAttendance).where(eq(eventAttendance.registrationId, input.registrationId as any)).limit(1);
  if (existing[0]) {
    return { attendance: existing[0], created: false };
  }
  const [row] = await db
    .insert(eventAttendance)
    .values({
      organizationId: input.organizationId as any,
      eventId: input.eventId as any,
      registrationId: input.registrationId as any,
      checkedInBy: input.checkedInBy ?? null,
    })
    .returning();
  return { attendance: row, created: true };
}

export async function findAttendanceByRegistrationId(db: DbOrTx, registrationId: string) {
  const rows = await db.select().from(eventAttendance).where(eq(eventAttendance.registrationId, registrationId as any)).limit(1);
  return rows[0] ?? null;
}

export async function countAttendancesForEvent(db: DbOrTx, eventId: string) {
  const rows = await db.select().from(eventAttendance).where(eq(eventAttendance.eventId, eventId as any));
  return rows.length;
}
