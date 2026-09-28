/**
 * GET /api/v1/events/[eventId]/checkin/summary — attendee counts, Wave3.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { eq, count } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { kajianEvents } from "@/server/db/schema/events";
import { eventRegistrations, eventAttendance } from "@/server/db/schema/registrations";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(request: Request, ctx: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await ctx.params;
  if (!isUuid(eventId)) return Response.json({ code: "VALIDATION_FAILED", message: "eventId tidak valid." }, { status: 422 });
  const db = getDb();
  const eventRows = await db.select().from(kajianEvents).where(eq(kajianEvents.id, eventId as any)).limit(1);
  const event = eventRows[0];
  if (!event) return Response.json({ code: "NOT_FOUND", message: "Event tidak ditemukan." }, { status: 404 });
  const registrations = await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId as any));
  const attendances = await db.select().from(eventAttendance).where(eq(eventAttendance.eventId, eventId as any));
  return Response.json({
    eventId,
    organizationId: event.organizationId,
    totalRegistered: registrations.length,
    totalCheckedIn: attendances.length,
    registrations: registrations.map(r => ({ id: r.id, attendeeEmail: r.attendeeEmail, attendeeName: r.attendeeName, shortCode: r.shortCode, status: r.status, createdAt: r.createdAt })),
    attendances: attendances.map(a => ({ id: a.id, registrationId: a.registrationId, checkedInAt: a.checkedInAt })),
  });
}
