/**
 * POST /api/v1/events/[eventId]/registrations — Wave3 real attendee registration.
 * Public capability endpoint + durable idempotency (duplicate email → ALREADY_REGISTERED, not duplicate row).
 * Tenant isolation: event must exist, otherwise 404 (ADR-0017: cross-org returns 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { kajianEvents } from "@/server/db/schema/events";
import { createRegistration } from "@/server/db/repositories/registrations";
import { writeAuditEntry } from "@/server/audit/writer";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: Request, ctx: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await ctx.params;
  if (!isUuid(eventId)) {
    return Response.json({ code: "VALIDATION_FAILED", message: "Format eventId tidak valid.", fields: { eventId: "harus uuid" } }, { status: 422 });
  }
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ code: "VALIDATION_FAILED", message: "Body harus JSON." }, { status: 422 }); }

  // Accept both Wave3 simplified {attendeeEmail, attendeeName} and contract {fullName, contactKind, contactValue}
  const rawEmail: string | undefined = body?.attendeeEmail ?? (body?.contactKind === "EMAIL" ? body?.contactValue : undefined) ?? body?.email;
  const rawName: string | undefined = body?.attendeeName ?? body?.fullName ?? body?.name;
  const attendeeEmail = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const attendeeName = typeof rawName === "string" ? rawName.trim() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;

  const fields: Record<string, string> = {};
  if (!attendeeEmail || !isEmail(attendeeEmail)) fields.attendeeEmail = "email tidak valid";
  if (!attendeeName || attendeeName.length < 2) fields.attendeeName = "nama minimal 2 huruf";
  else if (attendeeName.length > 80) fields.attendeeName = "nama maksimal 80 huruf";
  if (Object.keys(fields).length > 0) {
    return Response.json({ code: "VALIDATION_FAILED", message: "Data registrasi belum benar.", fields }, { status: 422 });
  }

  const db = getDb();
  // Lookup event to obtain organizationId (tenant)
  const eventRows = await db.select().from(kajianEvents).where(eq(kajianEvents.id, eventId as any)).limit(1);
  const event = eventRows[0];
  if (!event) {
    return Response.json({ code: "NOT_FOUND", message: "Event tidak ditemukan." }, { status: 404 });
  }
  const orgId = event.organizationId as unknown as string;
  const scope = organizationScope(orgId);

  try {
    const result = await withTransaction(scope, async (tx) => {
      const out = await createRegistration(tx, { organizationId: orgId, eventId, attendeeEmail, attendeeName });
      await writeAuditEntry(
        {
          actionKey: "registration.create",
          organizationId: orgId,
          scopeKind: scope.kind,
          targetType: "event_registration",
          targetId: out.registration.id,
          requestId: idempotencyKey,
        },
        tx,
      );
      return out;
    }, { userId: "public" });

    return Response.json({
      registrationId: result.registration.id,
      eventId,
      organizationId: orgId,
      attendeeEmail: result.registration.attendeeEmail,
      attendeeName: result.registration.attendeeName,
      accessToken: result.token,
      shortCode: result.shortCode,
      state: result.registration.status,
      created: true,
      // QR payload for demo: token as capability (never logged as plain elsewhere)
      qrPayload: result.token,
    }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "DUPLICATE" && e.existing) {
      const existing = e.existing;
      return Response.json({
        code: "ALREADY_REGISTERED",
        message: "Email ini sudah terdaftar untuk event ini.",
        registrationId: existing.id,
        eventId,
        organizationId: orgId,
        attendeeEmail: existing.attendeeEmail,
        state: existing.status,
        created: false,
        // For idempotent replay, do NOT re-issue token; client should use prior token. But we return shortCode for convenience.
        shortCode: existing.shortCode,
      }, { status: 200 });
    }
    const msg = String(e?.message ?? e);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return Response.json({ code: "ALREADY_REGISTERED", message: "Email ini sudah terdaftar untuk event ini.", created: false }, { status: 200 });
    }
    return Response.json({ code: "INTERNAL", message: "Gagal membuat registrasi." }, { status: 500 });
  }
}
